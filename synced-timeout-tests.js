
Tinytest.addAsync('SyncedTimeout basics', (test, done) => {

  SyncedTimeout.config.pollInterval = 10;
  SyncedTimeout.start();

  var startTime = (new Date()).getTime();
  var jobName = 'job-' + test.runId();
  SyncedTimeout.methods({
    [jobName]: (arg1, arg2) => {
      var endTime = (new Date()).getTime();
      test.equal(arg1, 42);
      test.equal(arg2, {foo: 'bar'});
      //give tests a lot of leeway when it comes to timing
      test.isTrue(endTime - startTime > 50, `${endTime} - ${startTime} = ${endTime - startTime} > 50`);
      test.isTrue(endTime - startTime < 1000, `${endTime} - ${startTime} = ${endTime - startTime} < 1000`);
      SyncedTimeout.stop();
      done();
    }
  });

  var timeoutId = SyncedTimeout.setTimeout(jobName, 100, 42, {foo: 'bar'});
});
