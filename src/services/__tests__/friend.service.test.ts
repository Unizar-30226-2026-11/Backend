import { FriendService} from '../friend.service';
import { prisma } from '../../lib/prisma';
import 'dotenv/config';

describe('FriendService - Pruebas Funciones', () => {

    beforeAll( () => {


    });

    beforeEach( () => {

        
    });

    describe('Sistema de Búsqueda por IDs de usuario', () => {

        describe('Búsqueda de Amigos. -> getConfirmedFriends() ', () => {

            test('Usuario Existente:', () => {


            });

            test('Usuario Inexistente:', () => {

                
            });

            test('Campos Incorrectos:', () => {

                
            });
        });

        describe('Búsqueda de Solicitudes Pendientes. -> getPendingRequests() ', () => {

            test('Registro Correcto:', () => {


            });

            test('Campos Vacíos:', () => {

                
            });

            test('Campos Incorrectos:', () => {

                
            });
        });

        describe('Comprobar relacion entre 2 usuarios. -> checkRelationshipStatus() ', () => {

            test('Relación Existente:', () => {


            });

            test('Relación Inexistente:', () => {

                
            });

            
        });
    });
    
    describe('Sistema de Peticiones de Amistad', () => {

        describe('Crear Peticion de Amistad -> createFriendRequest() ', () => {

            test('Relación Existente:', () => {


            });

            test('Relación Inexistente:', () => {

                
            });

            
        });

        describe('Buscar Peticion de Amistad -> findRequestById() ', () => {

            test('Relación Existente:', () => {


            });

            test('Relación Inexistente:', () => {

                
            });

            
        });

        describe('Crear Peticion de Amistad -> createFriendRequest() ', () => {

            test('Relación Existente:', () => {


            });

            test('Relación Inexistente:', () => {

                
            });

            
        });



    });

    

    afterAll( () => {


    });

    afterEach( () => {

        
    });

});