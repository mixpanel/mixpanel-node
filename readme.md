Mixpanel-node
=============

This library provides many of the features in the official javascript mixpanel library.  It is easy to use, and fully async.

Installation
------------

npm install mixpanel

Usage
-----

var mixpanel = require('mixpanel');

var mp_client = new mixpanel.Client('YOUR MIXPANEL TOKEN');

mp_client.track("my event", {
	distinct_id: "some unique client id",
	as: "many",
	properties: "as",
	you: "want"
}, function(err) {
	if(err) throw err;
});

Attribution/Credits
-------------------

Heavily inspired by the original js library copyright Mixpanel, Inc.
(http://mixpanel.com/)

Modifications by Carl Sverre