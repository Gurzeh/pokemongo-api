import {
  API_URL
} from '../env'

import _ from 'lodash'
import Request from 'request'
import ProtoBuf from 'protobufjs'

const POGOProtos = ProtoBuf.loadProtoFile({ root: "./src/", file: "POGOProtos/POGOProtos.proto" }).build("POGOProtos")

class Connection {
  constructor(props) {
    this.endPoint = API_URL
    this.auth_ticket = null
    this.cookieJar = Request.jar()
    this.request = Request.defaults({jar: this.cookieJar})
  }

  Request(requests, userObj){
    this._request(requests,userObj)
    .then(res => {
      //we have response (returns = response we want.. now lets parse it)
      var respt = {};
      requests.map( (req,key) => {
        //setFileName 
        var ResponseType = this._resolveProtoFilename(req.request)
        ResponseType = ResponseType+'Response'
        console.log(ResponseType)
        var Responses = POGOProtos.Networking.Responses
        try {
          respt[ResponseType] = Responses[ResponseType].decode(res.returns[key]);
        } catch(e) {
          respt[ResponseType] = {'error': e};
          console.log('err')
        }
      })
      console.log(respt)
    })
  }

  _request(reqs,userObj) {
    return new Promise( (resolve, reject) => {
      if (this.endPoint.length < 5 || !this.endPoint) throw new Error('No endPoint set!')
      if (userObj.latitude == 0 || userObj.longitude == 0) throw new Error('position missing')

      var req = this._serializeRequest(reqs)
      var request = this._serializeHeader(req, userObj)
      // //create buffer
      var protobuf = request.encode().toBuffer();

      var options = {
        url: this.endPoint,
        body: protobuf,
        encoding: null,
        headers: {
          'User-Agent': 'Niantic App'
        }
      }

      this.request.post(options, (err, response, body) => {
        if (response === undefined || body === undefined) {
          console.error('[!] RPC Server offline');
          throw new Error('RPC Server offline');
        }

        try {
          var res = POGOProtos.Networking.Envelopes.ResponseEnvelope.decode(body);
        } catch (e) {
          if (e.decoded) { // Truncated
            console.warn(e);
            res = e.decoded; // Decoded message with missing required fields
          }
        }

        if (res.auth_ticket) 
          this.auth_ticket = res.auth_ticket

        if (res.returns) resolve(res)
        else reject("Nothing in reponse..")
      })
    })
  }

  setEndpoint(user){
    return new Promise( resolve => {
      this._request([
        {request: 'GET_PLAYER' },
        {request: 'GET_HATCHED_EGGS' },
        {request: 'GET_INVENTORY' },
        {request: 'CHECK_AWARDED_BADGES' },
        {request: 'DOWNLOAD_SETTINGS' },
      ],user)
      .then(res => {
        if (res.api_url){
          this.endPoint = `https://${res.api_url}/rpc`
          console.error('[!] Endpoint set: '+ this.endPoint);
          resolve(this.endPoint)
        }else{
          console.error('[!] Endpoint missing in request, lets try again..');
          this.setEndpoint(user)
        }
      })
    })
  }

  _resolveProtoFilename(call){
    var fileName = ''
    call = call.split("_")
    call.map( word => {
      fileName += _.upperFirst(_.toLower(word))
    })
    return fileName;
  }
  
  _setEndpoint(body) {
    if (res.api_url) {
      console.log('[i] Received API Endpoint: ' + this.endPoint)
      resolve(this.endPoint)
    }
  }
  
  _serializeRequest(reqs) {
    return reqs.map( req => {
      var Requests = POGOProtos.Networking.Requests

      var reqId = Requests.RequestType[req.request]
      var request = new Requests.Request({'request_type': reqId})

      //set message?
      if (req.message != undefined){
        var MessageType = this._resolveProtoFilename(req.request)
        MessageType = MessageType+'Message'
        request.request_message = new Requests.Messages[MessageType](req.message)
      }
      return request
    })
  }

  _serializeHeader(req, userObj) {
    var data = {
      status_code: 2,
      request_id: 1469378659230941192,
      latitude: userObj.latitude,
      longitude: userObj.longitude,
      altitude: userObj.altitude,
      unknown12: 989,
      requests: req,
    }

    if(this.auth_ticket != null) {
      data.auth_ticket = this.auth_ticket
    } else {
      data.auth_info = new POGOProtos.Networking.Envelopes.RequestEnvelope.AuthInfo({
        provider: userObj.provider,
        token: new POGOProtos.Networking.Envelopes.RequestEnvelope.AuthInfo.JWT({
          contents: userObj.accessToken,
          unknown2: 59,
        })
      })
    }

    if (this.auth_ticket != null)
      data.auth_ticket = this.auth_ticket


    return new POGOProtos.Networking.Envelopes.RequestEnvelope(data);
  }

  set authTicket(body) {
    if (res.auth_ticket)
      this.auth_ticket = res.auth_ticket
  }

}

export default Connection
