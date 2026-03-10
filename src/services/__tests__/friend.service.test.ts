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

            test('Usuario Existente:', async () => {

                const resultado = await FriendService.getConfirmedFriends("u_1");
                    
                expect(resultado).toBeDefined();
                expect(resultado[0]).toEqual(expect.arrayContaining([
                    expect.objectContaining({
                        id: expect.stringMatching(/^u_\d+$/),
                        username: expect.stringMatching(/.+/),
                        status: expect.stringMatching(/^(DISCONNECTED|CONNECTED|UNKNOWN|IN_GAME)$/) 
                    })
                ]));
            });

            test('Usuario Inexistente:', async () => {

                const resultado = await FriendService.getConfirmedFriends("u_999999");
                    
                expect(resultado).toHaveLength(0);
                
            });

            test('Campos Vacíos:', async () => {

                await expect(FriendService.getConfirmedFriends("")).rejects.toThrow(); 
            });

            test('Campos Incorrectos:', async () => {

                await expect(FriendService.getConfirmedFriends("usuarioPrueba")).rejects.toThrow(); 
                
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