var mixpanel = require('mixpanel');

var mp_client = new mixpanel.Client('d09b8c65788b191705f8e46fee8dd244');

mp_client.track("my event", {
	distinct_id: "1111",
	as: "many",
	properties: "as",
	you: "want"
}, function(err) {
    console.log("sent event");
	if(err) { throw err; }
});

// manual funnel tracking is supported, but not recommended
mp_client.track_funnel("my funnel", 1, "first goal", {
	distinct_id: "1111"
}, function(err) {
    console.log("sent first funnel event");
	if(err) { throw err; }
});
mp_client.track_funnel("my funnel", 2, "second goal", {
	distinct_id: "1111"
}, function(err) {
    console.log("sent second funnel event");
	if(err) { throw err; }
});