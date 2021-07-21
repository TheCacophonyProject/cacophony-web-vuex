import crossFetch from "cross-fetch";
import store from "../stores/index";
import router from "../router";
import { CurrentViewAbortController } from "@/main";

const defaults = {
  mode: "cors",
  cache: "no-cache",
  headers: {},
};

/**
 * Makes a request to the given url with default handling for cors and authentication.
 * Returns a promise that when resolved, returns an object with a result, success boolean, and status code.
 * The result field is the JSON blob from the response body.
 * These fields can easily be resolved using object destructuring to directly assign the required information.
 * @param {RequestInfo} url The full url to send the request to
 * @param {RequestInit} init: The RequestInit info for things such as headers and body
 * @param {boolean} suppressGlobalMessaging: ability to suppress the global messaging and handle it at a component level. Ideally the option might be passed down from the component but for now we're setting the preference in the API layer. Not ideal, could be improved.
 * @returns {Promise<{result: any, success: boolean, status: number}>}
 */
export async function fetch(url, init, suppressGlobalMessaging = false) {
  init = {
    ...defaults,
    ...init,
    headers: {
      ...init.headers,
      Authorization: store.getters["User/getToken"],
    },
    signal: CurrentViewAbortController.controller.signal,
  };

  const response = await crossFetch(url, init);
  const status = response.status;

  const result = await response.json();
  if (status === 401) {
    store.dispatch("User/LOGOUT");
    store.dispatch(
      "Messaging/ERROR",
      "Error accessing your account.   Please log in again."
    );
    await router.push("login");
  } else {
    if (!suppressGlobalMessaging) {
      handleMessages(result, status); //TODO: don't have this on the fetch function; handle errors more explicitly (this should remove the suppressGlobalMessaging hack). Do we global error messages?
    }
    //console.log(result);
    //throw new Error(result);
  }
  return { result, status, success: response.ok };
}

function handleMessages(result, status) {
  let level;
  if (status < 200) {
    level = "INFO";
  } else if (status < 300) {
    level = "SUCCESS";
  } else if (status >= 400) {
    level = "ERROR";
  }

  if (result.errors) {
    for (const key in result.errors) {
      store.dispatch("Messaging/ERROR", result.errors[key].msg);
    }
  }
  result.messages &&
    result.messages.forEach((message) =>
      store.dispatch(`Messaging/${level}`, message)
    );
  if (result.errorType == "client") {
    store.dispatch("Messaging/ERROR", result.message);
  }
}
