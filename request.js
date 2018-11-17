/**
 * Custom Error class for Invalid Request Header.
 */
class InvalidRequestHeader extends Error {
  constructor(key, value) {
    super(`Invalid Header for the request. Found ${key}/${value}`)
  }
}

/**
 * Custom Error class for Invalid Body.
 */
class InvalidBody extends Error {
  constructor(body) {
    super(`Invalid body. Found ${body}`)
  }
}
 
/**
 * Map of HTTP methods and its value for window.fetch.
 */
const HTTP_METHOD = {
  GET: 'GET',
  PUT: 'PUT',
  POST: 'POST',
  DELETE: 'DELETE'
}

/**
 * Returns the object with helper function to test the types validity.
 * Example:
 * 
 *  const r = 'someRandomString'
 *  const isString = typeOf(r).isString() // returns true
 *  const isNumber = typeOf(r).isNumber() // returns false
 * 
 * @param {any} value 
 * @returns {object}
 */
function typeOf(value) {
  // returns the true type
  let actualType;
  if (value === null) {
    actualType =  'null'
  } else if (Array.isArray(value)) {
    actualType =  'array'
  } else if  (typeof value === 'number' && value.toString() === 'NaN') {
    actualType = 'NaN'
  } else {
    actualType = typeof value;
  }

  return {
    isNaN: () => actualType === 'NaN',
    isArray: () => actualType === 'array',
    isSymbol: () => actualType === 'symbol',
    isString: () => actualType === 'string',
    isObject: () => actualType === 'object',
    isNumber: () => actualType === 'number',
    isBoolean: () => actualType === 'boolean',
    isNotString: () => actualType !== 'string',
    isFunction: () => actualType === 'function',
    isUndefinedOrNull: () => actualType === 'null' || actualType === 'undefined',
  }
}



/**
 * Returns a function that returns request object with all goodies to prepare parameters/body/method.
 * It also exposes methods to make the http requests.
 * 
 * Note: __SOMEVARAIBLE  refers to private variables and are not meant to used by client code.
 * 
 * @param {string} baseURL 
 * @param {string} apiVersion 
 * 
 * @returns {function}
 */
function requestFactory(baseURL, apiVersion) {
  if (typeof baseURL !== 'string') {
    throw new TypeError('baseURL must be of type string')
  }
  /**
   * Wrapped function that request request object by wrapping baseURL and apiVersion in closure.
   * 
   * @param {string} URI
   */
  return function(URI) {
    return {
      baseURL, // root URL captured in closure
      apiVersion, // api version eg v1/v2/v3
      __path: URI, 
      __headers: {},
      __body: null,
      __middlewares: {
        body: null,
        header: null,
      },
      withHeader: function(key, value) {
        // sets the headers as long as the key and value are of type string
        if (typeOf(key).isNotString() || typeOf(value).isNotString()) {
          throw new InvalidRequestHeader(key, value)
        }
        this.__headers = {
          ...this.__headers,
          [key]: value
        }
        return this;
      },
      withAuthorization: function(token) {
        // set the header with Authorization as a key and token as a value
        return this.withHeader('Authorization', token)
      },
      withBearerAuthorization: function(token) {
        // set bearer token in authorization
        const bearerToken = `Bearer ${token}`
        return this.withAuthorization(bearerToken);
      },
      withBody: function(body) {
        // body can be anything except for null/undefined
        // it can be form-data/binary
        if (typeOf(body).isUndefinedOrNull()) {
          throw new InvalidBody(body)
        }
        this.__body = body;
        return this;
      },
      withContentType: function(type) {
        // sets the content type in the header 
        return this.withHeader('Content-Type', type);
      },
      withMiddleware: function({ header, body}) {
        if (typeOf(header).isFunction()) {
          this.__middlewares.header = header;
        }
        if (typeOf(body).isFunction()) {
          this.__middlewares.body = body;
        }

        return this;
      },
      _parameters: function(method) {
        // prepares parameter required for actual http request.
        const contentType = this.__headers['Content-Type']
        const isBodyIncluded = !typeOf(this.__body).isUndefinedOrNull() && typeOf(contentType).isString()
        let requestPayload = {
          method,
          headers: this.__headers,
        }
        // if body is included with the call to "withBody" then
        // we stringify the body if content type is application/json
        if (isBodyIncluded) { 
          requestPayload = {
            ...requestPayload,
            body: contentType.startsWith('application/json')
              ? JSON.stringify(this.__body)
              : this.__body
          }
        }  
        return requestPayload;
      },
      /**
       * _call (private) makes the http call and returns promise which might contain
       * either response or error depending upon the actual response by the remote/local
       * http server.
       *  
       * @param {string} method 
       * @param {string} path
       * 
       * @returns {promise} 
       */
      _call: function(method, path) {
        const url = typeOf(path).isString()
          ? `${baseURL}${path}`
          : `${baseURL}`

        return withMiddleware(this, () => fetch(url, this._parameters))
      },
      // wrapper around _call with POST method
      post: function(path) {
        return this._call(HTTP_METHOD.POST, path || this.__path);
      },
      // wrapper around this.post
      // this sets the content type to application/json
      // before making the actual post request
      postJSON: function(path) {
        // set content type to json/application if not set
        
        return this.withContentType('application/json').post(path || this.__path);
      },
      // wrapper around this._call
      put: function(path) {
        return this._call(HTTP_METHOD.PUT, path || this.__path);
      },
      // wrapper around this.put
      // this sets the content type to application/json
      // before making the actual put request.
      putJSON: function(path) {
        
        return this.withContentType('application/json').put(path || this.__path);
       },
      // wrapper around this._call with GET method
      get: function(path) {
        return this._call(HTTP_METHOD.GET, path || this.__path);
      },
      // wrapper around this._call with DELETE method
      delete: function(path) {
        return this._call(HTTP_METHOD.DELETE, path || this._path);
      }
    }
  }
  
  
}

// middleware support
async function withMiddleware(ctx, cb) {
  const middlewares = ctx.__middlewares;
  if (middlewares.header) {
    await middlewares.header(ctx.__headers)
  }

  if (middlewares.body) {
    await middlewares.body(ctx.__body)
  }
  return cb();
}


export default requestFactory;
