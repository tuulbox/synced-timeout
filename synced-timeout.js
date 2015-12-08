
SyncedTimeout = {
  methodsDefs: {},
  isRunning: false,
  runIntervalId: null,
  isProcessing: false,
  concurrentTasks: 0,
  config: {
    pollInterval: 1000,
    batchSize: 100,
    concurrentTaskLimit: 100
  }
};

function Task(doc) {
  _.extend(this, doc);
}

//TODO add some helper methods on Task like delay

SyncedTimeout.collection = new Mongo.Collection('tuul_synced_timeout', {
  transform: (doc) => {
    return new Task(doc);
  }
});

Meteor.startup(function() {
  SyncedTimeout.collection._ensureIndex({method: 1, runAt: 1});
});

/**
 * Poll for and process tasks. Used by SyncedTimeout.start.
 */
var processTasks = function() {
  if (this.isProcessing) {
    return;
  }
  try {
    this.isProcessing = true;
    let limit = Math.min(this.config.concurrentTaskLimit - this.concurrentTasks, this.config.batchSize);
    let availableMethods = _.keys(this.methodsDefs);
    let batch = this.collection.find(
      {
        method: {$in: availableMethods},
        runAt: {$lte: new Date()},
        assignedAt: {$exists: false}
      },
      {
        sort: {runAt: -1},
        limit: limit
      }
    );
    batch.forEach(task => {
      //try to assign this task
      let assigned = this.collection.update(
          {_id: task._id, assignedAt: {$ne: true}},
          {$set: {assignedAt: new Date()}}
      );
      if (!assigned) {
        return; //some other process got it
      }

      this.concurrentTasks++;
      //do the work async so we don't block up processTasks()
      Meteor.defer(() => {
        try {
          this.methodsDefs[task.method].apply(task, task.args);
        } catch (err) {
          console.log(err);
          //TODO maybe kick it back, add a blacklist, increment a counter
        } finally {
          this.concurrentTasks--;
        }

        //TODO support delayed tasks, or otherwise not removing it
        this.collection.remove({_id: task._id});
      });
    });
  } catch (err) {
    console.log(err);
  } finally {
    this.isProcessing = false;
  }
}.bind(SyncedTimeout);

/**
 * Starts polling for tasks
 */
SyncedTimeout.start = function() {
  if (!this.isRunning) {
    Meteor.setInterval(processTasks, this.config.pollInterval);
    this.isRunning = true;
  }
};

/**
 * Stops polling
 */
SyncedTimeout.stop = function() {
  if (this.isRunning && this.runIntervalId) {
    Meteor.clearInterval(this.runIntervalId);
    this.isRunning = false;
    this.runIntervalId = null;
  }
};

/**
 * Register some methods.
 * @param methods
 */
SyncedTimeout.methods = function(methods) {
  _.extend(this.methodsDefs, methods);
};

/**
 * Create a task to run the named method at the specified time.
 * @param method
 * @param runAt
 * @param {...*} var_args
 * @returns task id
 */
SyncedTimeout.runAt = function(method, runAt, var_args) {
  check(method, String);
  check(this.methodsDefs[method], Function);
  check(runAt, Date);

  let args = _.toArray(arguments).splice(2);

  return this.collection.insert({
    runAt: runAt,
    method: method,
    args: args
  });
};

/**
 * Create a task to run the named method after timeout ms.
 * @param method
 * @param timeout
 * @param {...*} var_args
 * @returns task id
 */
SyncedTimeout.setTimeout = function(method, timeout, var_args) {
  let runAt = new Date();
  runAt.setTime(runAt.getTime() + timeout);
  return this.runAt.apply(this,[method, runAt].concat(_.toArray(arguments).slice(2)));
};
