SyncedTimeout.config.pollInterval = 10;
SyncedTimeout.config.concurrentTaskLimit = 10;
SyncedTimeout.start();

Tinytest.addAsync('SyncedTimeout basics', (test, done) => {
  var startTime = (new Date()).getTime();
  var jobName = 'basics-' + test.runId();
  SyncedTimeout.methods({
    [jobName]: function(arg1, arg2) {
      var endTime = (new Date()).getTime();
      test.equal(arg1, 42);
      test.equal(arg2, {foo: 'bar'});
      //give tests a lot of leeway when it comes to timing
      test.isTrue(endTime - startTime > 50, `${endTime} - ${startTime} = ${endTime - startTime} > 50`);
      test.isTrue(endTime - startTime < 1000, `${endTime} - ${startTime} = ${endTime - startTime} < 1000`);
      //make sure when we're done the task is gone
      Meteor.defer(() => {
        test.isFalse(!!SyncedTimeout.getTask(this._id), 'expected to not find the task after run');
        done();
      });
    }
  });

  var timeoutId = SyncedTimeout.setTimeout(jobName, 100, 42, {foo: 'bar'});
});


Tinytest.addAsync('SyncedTimeout task delay', (test, done) => {
  var counter = 0;
  var jobName = 'delay-' + test.runId();
  SyncedTimeout.methods({
    [jobName]: function() {
      counter++;
      if (counter == 1) {
        this.delay(10);
        //make sure when we're done the task is still there
        Meteor.defer(() => {
          test.isTrue(!!SyncedTimeout.getTask(this._id), 'expected to find the task after delay');
        });
      } else if (counter == 2) {
        //success!
        //make sure when we're done the task is gone
        Meteor.defer(() => {
          test.isFalse(!!SyncedTimeout.getTask(this._id), 'expected to not find the task after run');
          done();
        });
      }

      test.isTrue(counter < 3, 'too many invocations');
    }
  });

  var task = SyncedTimeout.builder()
    .timeout(10)
    .method(jobName)
    .meta({foo: 42})
    .build();

  var task2 = SyncedTimeout.getTask(task._id);
  test.equal(task2.meta.foo, 42);
});

Tinytest.addAsync('SyncedTimeout concurrentTaskLimit', (test, done) => {
  var counter = 0;
  var concurrent = 0;
  var jobName = 'concurrent-' + test.runId();
  SyncedTimeout.methods({
    [jobName]: function() {
      concurrent++;
      test.isTrue(concurrent <= 10, 'too many concurrent executions');
      Meteor._sleepForMs(50); //wait a while
      concurrent--;

      if (++counter == 20)
        done();
    }
  });

  for (var i = 1; i <= 20; i++) {
    SyncedTimeout.builder()
      .timeout(0)
      .method(jobName)
      .build();
  }

});