var mixpanel = require('../lib/mixpanel-node');

var mp_client = new mixpanel.Client('d09b8c65788b191705f8e46fee8dd244');

mp_client.set_config({
    test: false,
    debug: false
});


var client_id;

var funnel_counter = {};

function funnel_test(funnel_name, goals) {
    function e(err) {
        if(err) { console.log("error: "+err); }
    }
    
    console.log("starting funnel: "+funnel_name);
    for(var i=0; i < goals.length; i++) {
        if(Math.random() > 0.9) { return; }
        
        console.log("\t"+i+": "+goals[i]);
        
        if(!(goals[i] in funnel_counter)) { funnel_counter[goals[i]] = 1; }
        else { funnel_counter[goals[i]] += 1; }
        
        mp_client.track_funnel(funnel_name, i+1, goals[i], {
            "distinct_id": client_id
        }, e);
    }
}

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

var funnel = [
    "visit",
    "view features page",
    "download trial",
    "view purchase page",
    "buy product"
];

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
    funnel_test("purchase", funnel);
    i--;
    if(i > 0) {
        setTimeout(function() {
            loop();
        }, 5000);
    } else {
        console.log("count");
        console.log(funnel_counter);
    }
};

loop();