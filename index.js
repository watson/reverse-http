'use strict'

var util = require('util')
var net = require('net')
var http = require('http')
var once = require('once')
var consume = require('consume-http-header')

module.exports = ReverseServer

util.inherits(ReverseServer, http.Server)

function ReverseServer (opts, onRequest) {
  if (!(this instanceof ReverseServer)) return new ReverseServer(opts, onRequest)

  var server = this
  var closed = false
  var upgradeRequest = generateRequest(opts)

  http.Server.call(this)

  this.setTimeout(0)
  this.on('close', onClose)
  if (onRequest) this.on('request', onRequest)

  connect()

  function connect () {
    if (closed) return

    var socket = net.connect(opts.port, opts.host)

    socket.on('connect', upgrade)
    socket.on('error', onError)

    function upgrade () {
      var onClose = once(connect)
      socket.on('close', onClose)
      socket.on('end', onClose)

      consume(socket, function (err, head) {
        if (err) {
          server.emit('error', err)
          server.close()
        } else if (head.statusCode === 101 &&
            head.headers.upgrade === 'PTTH/1.0' &&
            head.headers.connection === 'Upgrade') {
          server.emit('connection', socket)
        } else {
          server.emit('error', new Error('Unexpected response to PTTH/1.0 Upgrade request'))
          server.close()
        }
      })

      socket.write(upgradeRequest)
    }
  }

  function onClose () {
    closed = true
  }

  function onError (err) {
    server.emit('error', err)
  }
}

function generateRequest (opts) {
  opts = defaultOptions(opts)

  return Object.keys(opts.headers).reduce(function (s, field) {
    var value = opts.headers[field]
    if (!Array.isArray(value)) value = [value]
    return value.reduce(function (s, value) {
      return s + field + ': ' + value + '\r\n'
    }, s)
  }, opts.method + ' ' + opts.path + ' HTTP/1.1\r\n') + '\r\n'
}

function defaultOptions (opts) {
  if (!opts) opts = {}
  if (!opts.method) opts.method = 'POST'
  if (!opts.host) opts.host = opts.hostname || 'localhost'
  if (!opts.path) opts.path = '/'
  if (!opts.headers) opts.headers = {}
  if (!opts.headers['Host']) opts.headers['Host'] = opts.host
  if (!opts.headers['Upgrade']) opts.headers['Upgrade'] = 'PTTH/1.0'
  if (!opts.headers['Connection']) opts.headers['Connection'] = 'Upgrade'
  if (!opts.headers['Content-Length']) opts.headers['Content-Length'] = 0
  return opts
}
