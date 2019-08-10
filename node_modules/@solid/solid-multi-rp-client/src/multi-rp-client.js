'use strict'
const ClientStore = require('./client-store')
const OIDCRelyingParty = require('@solid/oidc-rp')
const DEFAULT_MAX_AGE = 86400

class MultiRpClient {
  /**
   * @constructor
   * @param [options={}] {Object}
   *
   * @param [options.localConfig={}] {Object}
   * @param [options.localConfig.issuer] {string}
   * @param [options.localConfig.redirect_uri] {string}
   * @param [options.localConfig.post_logout_redirect_uris] {Array<string>}
   *
   * Needed to initialize the ClientStore:
   *
   * @param [options.backend] {KVPFileStore} Either pass in a backend store
   * @param [options.path] {string} Or initialize the store from path.
   * @param [options.collectionName='clients'] {string}
   *
   * @param [options.debug] {Function}
   */
  constructor (options = {}) {
    this.store = new ClientStore(options)

    this.localConfig = options.localConfig || {}

    this.debug = options.debug || console.log.bind(console)
  }

  /**
   * Returns the authorization (login) URL for a given OIDC client (which
   * is tied to / registered with a specific OIDC Provider).
   *
   * @method authUrl
   * @param client {RelyingParty}
   * @param session {Session} req.session or similar
   * @param workflow {string} OIDC workflow type, one of 'code' or 'implicit'.
   * @return {string} Absolute URL for an OIDC auth call (to start either
   *   the Authorization Code workflow, or the Implicit workflow).
   */
  authUrl (client, session, workflow = 'code') {
    // let debug = this.debug
    let authParams = {
      // endpoint: 'signin',
      // response_mode: 'query',
      // response_mode: 'form_post',
      // client_id: client.client_id,
      redirect_uri: client.registration.redirect_uris[0]
      // state: '...',  // not doing state for the moment
      // scope: 'openid profile'
    }
    if (workflow === 'code') { // Authorization Code workflow
      authParams.response_type = 'code'
    } else if (workflow === 'implicit') {
      authParams.response_type = 'id_token token'
    }
    // console.log('client.createRequest(). client:', client.serialize())
    return client.createRequest(authParams, session)
      .then(uri => {
        return uri
      })
  }

  /**
   * Returns a constructed `/authorization` URL for a given issuer. Used for
   * starting the OIDC workflow.
   *
   * @param issuer {string} OIDC Provider URL
   * @param workflow {string} OIDC workflow type, one of 'code' or 'implicit'
   * @returns {Promise<string>}
   */
  authUrlForIssuer (issuer, session, workflow = 'code') {
    let debug = this.debug

    return this.clientForIssuer(issuer)
      .then((client) => {
        return this.authUrl(client, session, workflow)
      })
      .catch(error => {
        debug('Error in authUrlForIssuer(): ', error)
        throw error
      })
  }

  /**
   * @method clientForIssuer
   * @param issuerUri {string}
   * @returns {Promise<OIDCExpressClient>}
   */
  clientForIssuer (issuerUri) {
    let debug = this.debug
    return this.loadClient(issuerUri)
      .then(client => {
        if (client) {
          debug(`Client fetched for issuer ${issuerUri}`)
          return client
        }

        debug(`Client not present for issuer ${issuerUri}, initializing new client`)

        // client not already in store, create and register it
        let registrationConfig = this.registrationConfigFor(issuerUri)
        return this.registerClient(registrationConfig)
          .catch(error => {
            debug('Error registering a new client: ', error)
            throw error
          })
          .then(registeredClient => {
            // Store and return the newly registered client
            return this.persistClient(registeredClient)
              .catch(error => {
                debug('Error persisting registered client: ', error)
                throw error
              })
          })
      })
  }

  /**
   * @method loadClient
   * @param issuerUri {string}
   * @returns {Promise<OIDCExpressClient>}
   */
  loadClient (issuerUri) {
    return this.store.get(issuerUri)
  }

  get localIssuer () {
    return this.localConfig.issuer
  }

  /**
   * @method persistClient
   * @param expressClient {OIDCExpressClient}
   * @return {Promise<OIDCExpressClient>}
   */
  persistClient (expressClient) {
    return this.store.put(expressClient)
  }

  /**
   * @method redirectUriForIssuer
   * @param issuer {string} Issuer URI
   * @param baseUri {string}
   *
   * @throws {Error} If baseUri is missing.
   *
   * @return {string}
   */
  redirectUriForIssuer (issuerUri, baseUri = this.localConfig.redirect_uri) {
    if (!baseUri) {
      throw new Error('Cannot form redirect uri - base uri is missing')
    }
    let issuerId = encodeURIComponent(issuerUri)
    return `${baseUri}/${issuerId}`
  }

  registerClient (config) {
    // let debug = this.debug
    // debug('new OIDCRelyingParty.register()', config)
    this.debug('Registering new client for issuer ', config.issuer)

    return OIDCRelyingParty.register(config.issuer, config, {})
  }

  /**
   * @param issuer {string} URL of the OIDC Provider / issuer.
   * @param [config={}] {Object}
   */
  registrationConfigFor (issuer, config = {}) {
    let redirectUri = config.redirect_uri || this.redirectUriForIssuer(issuer)

    let defaultClientName = `Solid OIDC RP for ${issuer}`

    config.client_name = config.client_name || defaultClientName
    config.default_max_age = config.default_max_age || DEFAULT_MAX_AGE
    config.issuer = issuer
    config.grant_types = config.grant_types ||
      ['authorization_code', 'implicit', 'refresh_token', 'client_credentials']
    config.redirect_uris = config.redirect_uris || [ redirectUri ]
    config.response_types = config.response_types ||
      ['code', 'id_token token', 'code id_token token']
    config.post_logout_redirect_uris = config.post_logout_redirect_uris ||
      this.localConfig.post_logout_redirect_uris || []
    config.scope = config.scope || 'openid profile'
    // client_uri: 'https://github.com/solid/node-solid-server',
    // logo_uri: 'solid logo',
    // post_logout_redirect_uris: [ '...' ],
    return config
  }
}
module.exports = MultiRpClient
