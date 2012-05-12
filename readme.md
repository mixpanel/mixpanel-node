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
	
	// manual funnel tracking is supported, but not recommended
	mp_client.track_funnel("my funnel", 1, "first goal", {
		distinct_id: "unique identifier"
	}, function(err) {
		if(err) throw err;
	});
	mp_client.track_funnel("my funnel", 2, "second goal", {
		distinct_id: "unique identifier"
	}, function(err) {
		if(err) throw err;
	});

Attribution/Credits
-------------------

Heavily inspired by the original js library copyright Mixpanel, Inc.
(http://mixpanel.com/)

Modifications by Carl Sverre