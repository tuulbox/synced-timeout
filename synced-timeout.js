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
    if (limit < 1) {
      return;
    }
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


Builder = function() {
};

/**
 * Builder for constructing new tasks.
 * @returns {Builder}
 */
SyncedTimeout.builder = function() {
  return new Builder();
};

/**
 * Set the task to run at a specific date
 * @param runAt
 * @returns {Builder}
 */
Builder.prototype.runAt = function(runAt) {
  check(runAt, Date);
  this.runAt = runAt;
  return this;
};

/**
 * Set the task to run after a delay of timeout ms.
 * @param timeout
 * @returns {Builder}
 */
Builder.prototype.timeout = function(timeout) {
  check(timeout, Number);
  this.runAt = new Date();
  this.runAt.setTime(this.runAt.getTime() + timeout);
  return this;
};

/**
 * Set method and optionally arguments, any additional arguments are used.
 * @param method
 * @param {...*} varArgs
 */
Builder.prototype.method = function(method, varArgs) {
  check(method, String);
  check(SyncedTimeout.methodsDefs[method], Function);
  this.method = method;
  if (arguments.length > 1) {
    this.args = _.toArray(arguments).splice(1);
  }
  return this;
};

/**
 * Set method arguments array directly
 * @param args
 * @returns {Builder}
 */
Builder.prototype.args = function(args) {
  check(args, Array);
  this.args = args;
  return this;
};

/**
 * Save additional meta data in the collection, e.g. for search/modification outside of this api.
 * @param meta
 * @returns {Builder}
 */
Builder.prototype.meta = function(meta) {
  this.meta = meta;
  return this;
};

/**
 * Build the task and return the doc id.
 * @returns id
 */
Builder.prototype.build = function() {
  check(this.method, String);
  check(SyncedTimeout.methodsDefs[this.method], Function);
  check(this.runAt, Date);

  this.args = this.args || [];

  return SyncedTimeout.collection.insert({
    runAt: this.runAt,
    method: this.method,
    args: this.args,
    meta: this.meta
  });
};

/**
 * Create a task to run the named method at the specified time.
 * @param method
 * @param runAt
 * @param {...*} varArgs
 * @returns task id
 */
SyncedTimeout.runAt = function(method, runAt, varArgs) {
  let args = _.toArray(arguments).splice(2);
  return SyncedTimeout.builder()
      .method(method)
      .args(args)
      .runAt(runAt)
      .build();
};

/**
 * Create a task to run the named method after timeout ms.
 * @param method
 * @param timeout
 * @param {...*} varArgs
 * @returns task id
 */
SyncedTimeout.setTimeout = function(method, timeout, varArgs) {
  let args = _.toArray(arguments).splice(2);
  return SyncedTimeout.builder()
      .method(method)
      .args(args)
      .timeout(timeout)
      .build();
};
