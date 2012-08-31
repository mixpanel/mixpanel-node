Mixpanel-node
=============

This library provides many of the features in the official javascript mixpanel library.  It is easy to use, and fully async.

Installation
------------

    npm install mixpanel

Quick Start
-----

    // grab the Mixpanel factory
    var Mixpanel = require('../lib/mixpanel-node');

    // create an instance of the mixpanel client
    var mixpanel = Mixpanel.init('6fd9434dba686db2d1ab66b4462a3a67');

    // track an event with optional properties
    mixpanel.track("my event", {
        distinct_id: "some unique client id",
        as: "many",
        properties: "as",
        you: "want"
    });
    mixpanel.track("played_game");

    // create or update a user in Mixpanel Engage
    mixpanel.people.set("billybob", {
        $first_name: "Billy",
        $last_name: "Bob",
        plan: "premium",
        games_played: 1,
        points: 0
    });

    // set a single property on a user
    mixpanel.people.set("billybob", "plan", "free");

    // increment a numeric property
    mixpanel.people.increment("billybob", "games_played");

    // increment a numeric property by a different amount
    mixpanel.people.increment("billybob", "points", 15);

    // increment multiple properties
    mixpanel.people.increment("billybob", {"points": 10, "games_played":
                            1});

    // delete a user
    mixpanel.people.delete_user("billybob");

    // all functions that send data to mixpanel take an optional
    // callback as the last argument
    mixpanel.track("test", function(err) { if (err) throw err; });

Attribution/Credits
-------------------

Heavily inspired by the original js library copyright Mixpanel, Inc.
(http://mixpanel.com/)

Copyright (c) 2012 Carl Sverre

License
-------------------

Released under the MIT license.  See file called LICENSE for more
details.
