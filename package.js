Package.describe({
  name: 'tuul:synced-timeout',
  version: '0.0.3',
  summary: 'A simple distributed timeout (timed task) system for Meteor',
  git: 'https://github.com/tuulbox/synced-timeout.git',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.2.0.2');
  api.use('ecmascript');
  api.use('ejson');
  api.use('random');
  api.use('mongo');
  api.use('check');
  api.use('underscore');

  api.addFiles('synced-timeout.js', 'server');
  api.export('SyncedTimeout', 'server');
});

Package.onTest(function(api) {
  api.use('ecmascript');
  api.use('tinytest');
  api.use('tuul:synced-timeout');
  api.addFiles('synced-timeout-tests.js', 'server');
});
