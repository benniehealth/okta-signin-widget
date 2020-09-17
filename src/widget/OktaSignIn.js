/*globals module */
import _ from 'underscore';
import config from 'config/config.json';
import OAuth2Util from 'util/OAuth2Util';
import Util from 'util/Util';
import OktaAuth from '@okta/okta-auth-js';
import V1Router from 'LoginRouter';
import V2Router from 'v2/WidgetRouter';

var OktaSignIn = (function () {

  var router;

  function getProperties (authClient, Router, widgetOptions = {}) {
    function render (renderOptions, successFn, errorFn) {
      if (router) {
        throw new Error('An instance of the widget has already been rendered. Call remove() first.');
      }

      /**
       * -- Development Mode --
       * When the page loads, provide a helpful message to remind the developer that
       * tokens have not been removed from the hash fragment.
       */
      if (this.hasTokensInUrl()) {
        Util.debugMessage(`
            Looks like there are still tokens in the URL! Don't forget to parse and store them.
            See: https://github.com/okta/okta-signin-widget/#hastokensinurl
          `);
      }

      router = new Router(
        _.extend({}, widgetOptions, renderOptions, {
          authClient: authClient,
          globalSuccessFn: successFn,
          globalErrorFn: errorFn,
        })
      );
      router.start();
    }

    function hide () {
      if (router) {
        router.hide();
      }
    }

    function show () {
      if (router) {
        router.show();
      }
    }

    function remove () {
      if (router) {
        router.remove();
        router = undefined;
      }
    }

    /**
     * Check if tokens or a code have been passed back into the url, which happens in
     * the social auth IDP redirect flow.
     */
    function hasTokensInUrl () {
      var authParams = this.authClient.options;
      if (authParams.pkce || authParams.responseType === 'code' || authParams.responseMode === 'query') {
        // Look for code
        return authParams.responseMode === 'fragment'
          ? Util.hasCodeInUrl(window.location.hash)
          : Util.hasCodeInUrl(window.location.search);
      }
      // Look for tokens (Implicit OIDC flow)
      return Util.hasTokensInHash(window.location.hash);
    }

    /**
     * Renders the Widget with opinionated defaults for the full-page
     * redirect flow.
     * @param options - options for the signin widget
     */
    function showSignInToGetTokens (options) {
      var renderOptions = OAuth2Util.transformShowSignInToGetTokensOptions(options, config);
      return render.call(this, renderOptions);
    }

    // Properties exposed on OktaSignIn object.
    return {
      renderEl: render,
      authClient: authClient,
      showSignInToGetTokens: showSignInToGetTokens,
      hasTokensInUrl: hasTokensInUrl,
      hide: hide,
      show: show,
      remove: remove,
    };
  }

  function createAuthClient (options) {
    var authParams = _.extend(
      {
        transformErrorXHR: Util.transformErrorXHR,
        headers: {
          'X-Okta-User-Agent-Extended': 'okta-signin-widget-' + config.version,
        },
        clientId: options.clientId,
        redirectUri: options.redirectUri,
      },
      options.authParams
    );

    if (!authParams.issuer) {
      authParams.issuer = options.baseUrl + '/oauth2/default';
    }

    return new OktaAuth(authParams);
  }

  /**
   * Render the sign in widget to an element.
   * @param options - options for the signin widget.
   *        Must have an el or $el property to render the widget to.
   * @param success - success callback function
   * @param error - error callback function
   */
  function OktaSignIn (options) {
    Util.debugMessage(`
        The Okta Sign-In Widget is running in development mode.
        When you are ready to publish your app, embed the minified version to turn on production mode.
        See: https://developer.okta.com/code/javascript/okta_sign-in_widget#cdn
      `);

    var authClient = createAuthClient(options);

    // reload if state token is expired, but only when tab is active
    var hidden, visibilityChange; 
    if (typeof document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support
      hidden = "hidden";
      visibilityChange = "visibilitychange";
    } else if (typeof document.msHidden !== "undefined") {
      hidden = "msHidden";
      visibilityChange = "msvisibilitychange";
    } else if (typeof document.webkitHidden !== "undefined") {
      hidden = "webkitHidden";
      visibilityChange = "webkitvisibilitychange";
    }

    var handlePageVisibilityChange = () => {
      var expireAt = new Date(sessionStorage.getItem('expiresAt'));
      if (!document[hidden] && expireAt) {       
        var nowDate = new Date();
        if(nowDate > expireAt) {
          //Discusse we can warn user to reload the page by themseleves ?? instead of auto reload
          location.reload();
        }
      }
    }

    var Router;
    if (options.stateToken && !Util.isV1StateToken(options.stateToken)) {
      Router = V2Router;
    } else {
      Router = V1Router;
    }

    sessionStorage.setItem('stateToken', options.stateToken);
    sessionStorage.setItem('expiresAt', options.expiresAt);

    _.extend(this, Router.prototype.Events);
    _.extend(this, getProperties(authClient, Router, options));

    // Triggers the event up the chain so it is available to the consumers of the widget.
    this.listenTo(Router.prototype, 'all', this.trigger);

    document.addEventListener(visibilityChange, handlePageVisibilityChange, false);

    // On the first afterRender event (usually when the Widget is ready) - emit a 'ready' event
    this.once('afterRender', function (context) {
      this.trigger('ready', context);
    });
  }

  return OktaSignIn;
})();
module.exports = OktaSignIn;
