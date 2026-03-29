# PSOFT Game WebSockets API 1.0.0 documentation

Especificación de la API de WebSockets (Socket.IO) para el Lobby, Chat y Juego.
Define los eventos que el cliente puede enviar (publish) y recibir (subscribe) del servidor,
junto con sus esquemas de datos correspondientes (payloads).


## Table of Contents

* [Servers](#servers)
  * [production](#production-server)
* [Operations](#operations)
  * [PUB client:lobby:join](#pub-clientlobbyjoin-operation)
  * [PUB client:lobby:leave](#pub-clientlobbyleave-operation)
  * [PUB client:lobby:start](#pub-clientlobbystart-operation)
  * [PUB client:game:action](#pub-clientgameaction-operation)
  * [PUB client:chat:send](#pub-clientchatsend-operation)
  * [SUB server:error](#sub-servererror-operation)
  * [SUB server:lobby:state_updated](#sub-serverlobbystate_updated-operation)
  * [SUB server:game:state_updated](#sub-servergamestate_updated-operation)
  * [SUB server:game:ended](#sub-servergameended-operation)
  * [SUB server:chat:message_received](#sub-serverchatmessage_received-operation)
  * [SUB game:started](#sub-gamestarted-operation)

## Servers

### `production` Server

* URL: `localhost:3000`
* Protocol: `ws`

Endpoint principal de conexiones Socket.IO


## Operations

### PUB `client:lobby:join` Operation

El cliente solicita unirse a un lobby.

#### Message Join Lobby Payload `ClientLobbyJoin`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| lobbyCode | string | Código alfanumérico de 4 caracteres del lobby | - | - | **required** |

> Examples of payload _(generated)_

```json
{
  "lobbyCode": "string"
}
```



### PUB `client:lobby:leave` Operation

El cliente abandona el lobby intencionalmente.

#### Message Payload Vacio `EmptyMessage`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | No se espera ningún payload o se ignora. | - | - | **additional properties are allowed** |

> Examples of payload _(generated)_

```json
{}
```



### PUB `client:lobby:start` Operation

El host del lobby solicita iniciar el juego.

#### Message Payload Vacio `EmptyMessage`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | No se espera ningún payload o se ignora. | - | - | **additional properties are allowed** |

> Examples of payload _(generated)_

```json
{}
```



### PUB `client:game:action` Operation

El cliente envía una acción de juego al servidor (arquitectura centralizada en el motor).

#### Message Game Action Payload `ClientGameAction`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| lobbyCode | string | Código de la sala | - | - | **required** |
| actionType | string | Tipo de acción que el jugador quiere ejecutar | allowed (`"SUBMIT_STORY"`, `"PLAY_CARD"`, `"VOTE_CARD"`, `"USE_POWERUP"`) | - | **required** |
| payload | object | Datos específicos de la acción (ID de la carta jugada, pista escrita, etc.) | - | - | **additional properties are allowed** |

> Examples of payload _(generated)_

```json
{
  "lobbyCode": "string",
  "actionType": "SUBMIT_STORY",
  "payload": {}
}
```



### PUB `client:chat:send` Operation

El cliente envía un mensaje al chat del lobby.

#### Message Chat Send Payload `ClientChatSend`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| lobbyCode | string | - | - | 4 characters | **required** |
| text | string | Texto del mensaje enviado | - | [ 1 .. 255 ] characters | **required** |

> Examples of payload _(generated)_

```json
{
  "lobbyCode": "stri",
  "text": "string"
}
```



### SUB `server:error` Operation

El servidor emite un evento de error cuando algo falla.

#### Message Error Payload `ServerError`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| message | string | Mensaje descriptivo del error | - | - | **required** |
| code | string | Opcional. Código interno de error | - | - | - |

> Examples of payload _(generated)_

```json
{
  "message": "string",
  "code": "string"
}
```



### SUB `server:lobby:state_updated` Operation

El servidor emite el estado actualizado del lobby a todos los jugadores en él (ej. cuando alguien entra/sale).

#### Message Lobby State Updated `ServerLobbyStateUpdated`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | Objeto que representa el modelo completo actualizado de LobbyService. | - | - | **additional properties are allowed** |
| id | string | - | - | - | - |
| code | string | - | - | - | - |
| hostId | string | - | - | - | - |
| players | array&lt;object&gt; | - | - | - | - |
| players.id | string | - | - | - | - |
| players.username | string | - | - | - | - |

> Examples of payload _(generated)_

```json
{
  "id": "string",
  "code": "string",
  "hostId": "string",
  "players": [
    {
      "id": "string",
      "username": "string"
    }
  ]
}
```



### SUB `server:game:state_updated` Operation

El motor de juego actualiza el estado y emite la "foto" completa de la partida.

#### Message Game State Updated Payload `ServerGameStateUpdated`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| state | object | El JSON completo con el estado de la partida guardado en Redis (GameState completo). | - | - | **required**, **additional properties are allowed** |
| lastAction | string | Opcional. Indica la última acción tomada que provocó esta actualización (para animaciones del frontend). | - | - | - |

> Examples of payload _(generated)_

```json
{
  "state": {},
  "lastAction": "string"
}
```



### SUB `server:game:ended` Operation

Notificación de que el juego ha terminado.

#### Message Payload Vacio `EmptyMessage`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | No se espera ningún payload o se ignora. | - | - | **additional properties are allowed** |

> Examples of payload _(generated)_

```json
{}
```



### SUB `server:chat:message_received` Operation

Un mensaje de chat ha sido recibido y retransmitido a todos en el lobby.

#### Message Chat Message Received Payload `ServerChatMessageReceived`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| username | string | Nombre del usuario que mandó el mensaje | - | - | **required** |
| text | string | Contenido del mensaje original | - | - | **required** |
| timestamp | string | Timestamp ISO-8601 del momento en que el servidor procesó el chat | - | format (`date-time`) | **required** |

> Examples of payload _(generated)_

```json
{
  "username": "string",
  "text": "string",
  "timestamp": "2019-08-24T14:15:22Z"
}
```



### SUB `game:started` Operation

Notificación de que la partida ha iniciado oficialmente (generalmente para que el frontend cambie de pantalla a modo de juego).

#### Message Game Started Notification `GameStarted`

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| lobbyCode | string | - | - | - | **required** |

> Examples of payload _(generated)_

```json
{
  "lobbyCode": "string"
}
```



