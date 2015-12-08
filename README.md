tuul:synced-timeout
========================

A simple distributed timeout and queue system for Meteor. It supported scheduling tasks to run in the future (or now) 
across one or more meteor instances. It is implemented as a simple Mongo queue-like collection.

Synced-timeout is designed for handling several small one-time tasks and has mechanisms for controlling concurrency and
distributing work by type.

Use
------------------------

This is similar to, and inspired by [synced-cron](https://atmospherejs.com/percolate/synced-cron), but is designed to 
work better with one time tasks. We had problems using [synced-cron](https://atmospherejs.com/percolate/synced-cron) 
for one-time tasks that should have run in the past or will run in the immediate future.

Methods must be registered for use later, and by controlling which you register at run-time, it is possible to divvy 
up work by type across different meteor instances. Nodes will only pull tasks for methods they have registered.

Synced-timeout operates in an at-most-once delivery where it is possible to lose tasks during a poorly timed outage
but is not possible to run a task more than once. An at-least-once delivery option is planned. For a good explanation
of the differences, see
[You Cannot Have Exactly-Once Delivery](http://bravenewgeek.com/you-cannot-have-exactly-once-delivery/)

Concurrency is controlled by `SyncedTimeout.concurrentTaskLimit`. This limits the number of outstanding fibers operating 
on tasks on a single node. `SyncedTimeout.batchSize` controls how many tasks will be pulled at one time (the lesser of 
batch size and available task slots is fetched).

Polling frequency is controlled with `SyncedTimeout.pollInterval`. 

### Configuration ###

* SyncedTimeout.pollInterval
* SyncedTimeout.batchSize
* SyncedTimeout.concurrentTaskLimit

### API ###

* methods({foo: function(){...}})
* start()
* stop()
* setTimeout(method, timeoutMs, args...)
* runAt((method, date, args...)
* builder
  * method(method, args...)
  * args([arg1, arg2])
  * runAt(date)
  * timeout(timeoutMs)
  * meta({foo: 42})
  * build() -> Task
* Task
  * task.delay(timeoutMs)
  * task.reschedule(date)
  

#### TODO ####
* clearTimeout

* config.semantics = atLeastOnce
