import Mixpanel from "../lib/mixpanel-node";

const callback: Mixpanel.Callback = (error) => {
  if (error) {
    const statusCode: number | undefined = error.statusCode;
    const ordinaryError: Error = error;
    console.log(statusCode, ordinaryError.message);
  }
};
const batchCallback: Mixpanel.BatchCallback = (errors) => {
  if (errors) {
    const statusCode: number | undefined = errors[0].statusCode;
    console.log(statusCode);
  }
};

callback(new Error("network error"));
batchCallback([new Error("network error")]);
