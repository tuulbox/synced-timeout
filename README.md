tuul:synced-timeout
========================

A simple distributed timeout system for Meteor. It supported scheduling tasks to run in the future (or now) across one 
or more meteor instances.

### Configuration ###

* SyncedTimeout.pollInterval
* SyncedTimeout.batchSize
* SyncedTimeout.concurrentTaskLimit

### API ###

* methods(methodDefs)
* start()
* stop()
* setTimeout(method, timeout, args...)
* runAt((method, date, args...)

#### TODO ####
* clearTimeout
* updateTimeout

* task.delay


* config.atLeastOnce
* config.atMostOnce

