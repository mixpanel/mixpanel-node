var mixpanel = require('../lib/mixpanel-node');

var mp_client = new mixpanel.Client('89c4df475859a3323fd9f72237ed7260');

mp_client.set_config({
    test: false,
    debug: false
});


var client_id;

function events_test(events) {
    function e(err) {
        if(err) { console.log("error: "+err); }
    }
    
    console.log("starting events test");
    for(var i=0; i < events.length; i++) {
        if(Math.random() < 0.4) { return; }
        console.log("\t"+i+": "+events[i]);
        mp_client.track(events[i], {
            distinct_id: client_id
        }, e);
    }
}

var events = [
    "do the jig",
    "play it twice",
    "wooo woo!"
];

var i = 10;
var loop = function() {
    client_id = Math.floor(Math.random() * 100000);
    console.log("\nNew Client: "+client_id);
    events_test(events);
    i--;
    if(i > 0) {
        setTimeout(function() {
            loop();
        }, 5000);
    } else {
        console.log("count");
    }
};

loop();
