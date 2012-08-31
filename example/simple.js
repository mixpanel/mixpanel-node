var mixpanel = require('mixpanel');

var mp_client = new mixpanel.Client('89c4df475859a3323fd9f72237ed7260');

mp_client.track("my event", {
	distinct_id: "1111",
	as: "many",
	properties: "as",
	you: "want"
}, function(err) {
    console.log("sent event");
	if(err) { throw err; }
});
