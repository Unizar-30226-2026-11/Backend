
    const schema = {
  "asyncapi": "2.6.0",
  "info": {
    "title": "PSOFT Game WebSockets API",
    "version": "1.0.0",
    "description": "Especificación de la API de WebSockets (Socket.IO) para el Lobby, Chat y Juego.\nDefine los eventos que el cliente puede enviar (publish) y recibir (subscribe) del servidor,\njunto con sus esquemas de datos correspondientes (payloads).\n"
  },
  "servers": {
    "production": {
      "url": "localhost:3000",
      "protocol": "ws",
      "description": "Endpoint principal de conexiones Socket.IO"
    }
  },
  "channels": {
    "client:lobby:join": {
      "description": "El cliente solicita unirse a un lobby.",
      "publish": {
        "message": {
          "name": "ClientLobbyJoin",
          "title": "Join Lobby Payload",
          "payload": {
            "type": "object",
            "properties": {
              "lobbyCode": {
                "type": "string",
                "description": "Código alfanumérico de 4 caracteres del lobby",
                "x-parser-schema-id": "<anonymous-schema-2>"
              }
            },
            "required": [
              "lobbyCode"
            ],
            "x-parser-schema-id": "<anonymous-schema-1>"
          }
        }
      }
    },
    "client:lobby:leave": {
      "description": "El cliente abandona el lobby intencionalmente.",
      "publish": {
        "message": {
          "name": "EmptyMessage",
          "title": "Payload Vacio",
          "payload": {
            "type": "object",
            "description": "No se espera ningún payload o se ignora.",
            "x-parser-schema-id": "<anonymous-schema-3>"
          }
        }
      }
    },
    "client:lobby:start": {
      "description": "El host del lobby solicita iniciar el juego.",
      "publish": {
        "message": "$ref:$.channels.client:lobby:leave.publish.message"
      }
    },
    "client:game:action": {
      "description": "El cliente envía una acción de juego al servidor (arquitectura centralizada en el motor).",
      "publish": {
        "message": {
          "name": "ClientGameAction",
          "title": "Game Action Payload",
          "payload": {
            "type": "object",
            "properties": {
              "lobbyCode": {
                "type": "string",
                "description": "Código de la sala",
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "actionType": {
                "type": "string",
                "enum": [
                  "SUBMIT_STORY",
                  "PLAY_CARD",
                  "VOTE_CARD",
                  "USE_POWERUP"
                ],
                "description": "Tipo de acción que el jugador quiere ejecutar",
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              "payload": {
                "type": "object",
                "description": "Datos específicos de la acción (ID de la carta jugada, pista escrita, etc.)",
                "x-parser-schema-id": "<anonymous-schema-7>"
              }
            },
            "required": [
              "lobbyCode",
              "actionType"
            ],
            "x-parser-schema-id": "<anonymous-schema-4>"
          }
        }
      }
    },
    "client:chat:send": {
      "description": "El cliente envía un mensaje al chat del lobby.",
      "publish": {
        "message": {
          "name": "ClientChatSend",
          "title": "Chat Send Payload",
          "payload": {
            "type": "object",
            "properties": {
              "lobbyCode": {
                "type": "string",
                "maxLength": 4,
                "minLength": 4,
                "x-parser-schema-id": "<anonymous-schema-9>"
              },
              "text": {
                "type": "string",
                "maxLength": 255,
                "minLength": 1,
                "description": "Texto del mensaje enviado",
                "x-parser-schema-id": "<anonymous-schema-10>"
              }
            },
            "required": [
              "lobbyCode",
              "text"
            ],
            "x-parser-schema-id": "<anonymous-schema-8>"
          }
        }
      }
    },
    "server:error": {
      "description": "El servidor emite un evento de error cuando algo falla.",
      "subscribe": {
        "message": {
          "name": "ServerError",
          "title": "Error Payload",
          "payload": {
            "type": "object",
            "properties": {
              "message": {
                "type": "string",
                "description": "Mensaje descriptivo del error",
                "x-parser-schema-id": "<anonymous-schema-12>"
              },
              "code": {
                "type": "string",
                "description": "Opcional. Código interno de error",
                "x-parser-schema-id": "<anonymous-schema-13>"
              }
            },
            "required": [
              "message"
            ],
            "x-parser-schema-id": "<anonymous-schema-11>"
          }
        }
      }
    },
    "server:lobby:state_updated": {
      "description": "El servidor emite el estado actualizado del lobby a todos los jugadores en él (ej. cuando alguien entra/sale).",
      "subscribe": {
        "message": {
          "name": "ServerLobbyStateUpdated",
          "title": "Lobby State Updated",
          "payload": {
            "type": "object",
            "description": "Objeto que representa el modelo completo actualizado de LobbyService.",
            "properties": {
              "id": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-15>"
              },
              "code": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-16>"
              },
              "hostId": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-17>"
              },
              "players": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-20>"
                    },
                    "username": {
                      "type": "string",
                      "x-parser-schema-id": "<anonymous-schema-21>"
                    }
                  },
                  "x-parser-schema-id": "<anonymous-schema-19>"
                },
                "x-parser-schema-id": "<anonymous-schema-18>"
              }
            },
            "x-parser-schema-id": "<anonymous-schema-14>"
          }
        }
      }
    },
    "server:game:state_updated": {
      "description": "El motor de juego actualiza el estado y emite la \"foto\" completa de la partida.",
      "subscribe": {
        "message": {
          "name": "ServerGameStateUpdated",
          "title": "Game State Updated Payload",
          "payload": {
            "type": "object",
            "properties": {
              "state": {
                "type": "object",
                "description": "El JSON completo con el estado de la partida guardado en Redis (GameState completo).",
                "x-parser-schema-id": "<anonymous-schema-23>"
              },
              "lastAction": {
                "type": "string",
                "description": "Opcional. Indica la última acción tomada que provocó esta actualización (para animaciones del frontend).",
                "x-parser-schema-id": "<anonymous-schema-24>"
              }
            },
            "required": [
              "state"
            ],
            "x-parser-schema-id": "<anonymous-schema-22>"
          }
        }
      }
    },
    "server:game:ended": {
      "description": "Notificación de que el juego ha terminado.",
      "subscribe": {
        "message": "$ref:$.channels.client:lobby:leave.publish.message"
      }
    },
    "server:chat:message_received": {
      "description": "Un mensaje de chat ha sido recibido y retransmitido a todos en el lobby.",
      "subscribe": {
        "message": {
          "name": "ServerChatMessageReceived",
          "title": "Chat Message Received Payload",
          "payload": {
            "type": "object",
            "properties": {
              "username": {
                "type": "string",
                "description": "Nombre del usuario que mandó el mensaje",
                "x-parser-schema-id": "<anonymous-schema-26>"
              },
              "text": {
                "type": "string",
                "description": "Contenido del mensaje original",
                "x-parser-schema-id": "<anonymous-schema-27>"
              },
              "timestamp": {
                "type": "string",
                "format": "date-time",
                "description": "Timestamp ISO-8601 del momento en que el servidor procesó el chat",
                "x-parser-schema-id": "<anonymous-schema-28>"
              }
            },
            "required": [
              "username",
              "text",
              "timestamp"
            ],
            "x-parser-schema-id": "<anonymous-schema-25>"
          }
        }
      }
    },
    "game:started": {
      "description": "Notificación de que la partida ha iniciado oficialmente (generalmente para que el frontend cambie de pantalla a modo de juego).",
      "subscribe": {
        "message": {
          "name": "GameStarted",
          "title": "Game Started Notification",
          "payload": {
            "type": "object",
            "properties": {
              "lobbyCode": {
                "type": "string",
                "x-parser-schema-id": "<anonymous-schema-30>"
              }
            },
            "required": [
              "lobbyCode"
            ],
            "x-parser-schema-id": "<anonymous-schema-29>"
          }
        }
      }
    }
  },
  "components": {
    "messages": {
      "EmptyMessage": "$ref:$.channels.client:lobby:leave.publish.message",
      "ClientLobbyJoin": "$ref:$.channels.client:lobby:join.publish.message",
      "ClientGameAction": "$ref:$.channels.client:game:action.publish.message",
      "ClientChatSend": "$ref:$.channels.client:chat:send.publish.message",
      "ServerError": "$ref:$.channels.server:error.subscribe.message",
      "ServerLobbyStateUpdated": "$ref:$.channels.server:lobby:state_updated.subscribe.message",
      "ServerGameStateUpdated": "$ref:$.channels.server:game:state_updated.subscribe.message",
      "ServerChatMessageReceived": "$ref:$.channels.server:chat:message_received.subscribe.message",
      "GameStarted": "$ref:$.channels.game:started.subscribe.message"
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  