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

/**
 * Sets the task to run after timeout ms. If called while the task is running, it is rescheduled.
 * @param timeout
 */
Task.prototype.delay = function(timeout) {
  let runAt = new Date();
  runAt.setTime(runAt.getTime() + timeout);
  this.reschedule(runAt);
};

/**
 * Sets the task to run at the specified time. If called while the task is running, it is rescheduled.
 * @param runAt
 */
Task.prototype.reschedule = function(runAt) {
  check(runAt, Date);
  this.rescheduled = true;
  SyncedTimeout.collection.update(
    {_id: this._id},
    {$set: {runAt: runAt}, $unset: {assignedAt: ''}}
  );
};

SyncedTimeout.collection = new Mongo.Collection('tuul_synced_timeout', {
  transform: (doc) => {
    return new Task(doc);
  }
});

Meteor.startup(function() {
  SyncedTimeout.collection._ensureIndex({method: 1, runAt: 1});
});

SyncedTimeout.getTask = function(id) {
  return this.collection.findOne({_id: id});
};

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
        {_id: task._id, assignedAt: {$exists: false}},
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

        //remove task unless it has been rescheduled
        if (!task.rescheduled) {
          this.collection.remove({_id: task._id});
        }
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
 * Build the task.
 * @returns Task
 */
Builder.prototype.build = function() {
  this.args = this.args || [];
  this.runAt = this.runAt || new Date();

  check(this.method, String);
  check(SyncedTimeout.methodsDefs[this.method], Function);
  check(this.runAt, Date);

  let doc = {
    _id: Random.id(),
    runAt: this.runAt,
    method: this.method,
    args: this.args,
    meta: this.meta
  };

  SyncedTimeout.collection.insert(doc);
  return new Task(doc);
};

/**
 * Create a task to run the named method at the specified time.
 * @param method
 * @param runAt
 * @param {...*} varArgs
 * @returns Task
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
 * @returns Task
 */
SyncedTimeout.setTimeout = function(method, timeout, varArgs) {
  let args = _.toArray(arguments).splice(2);
  return SyncedTimeout.builder()
    .method(method)
    .args(args)
    .timeout(timeout)
    .build();
};
