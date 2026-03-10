import { UserService} from '../user.service';
import { prisma } from '../../lib/prisma';
import 'dotenv/config';

describe('UserService - Pruebas Funciones', () => {

    beforeAll( () => {


    })

    beforeEach( () => {

        
    })

    describe('Sistema de Búsqueda por IDs de usuario', () => {

        describe('Búsqueda de un solo usuario. ', () => {

            describe('Obtener perfil General -> getUserProfile() ', () => {

                test('Usuario Existente:', () => {

                });

                test('Usuario Inexistente:', () => {

                    
                });

                test('Campos Incorrectos:', () => {

                    
                });
            });

            describe('Obtener balance (saldo) -> getUserEconomy() ', () => {

                test('Usuario Existente:', () => {


                });

                test('Usuario Inexistente:', () => {

                    
                });

                test('Campos Incorrectos:', () => {

                    
                });
            });

            describe('Obtener Cartas -> getUserCards() ', () => {

                test('Usuario Existente:', () => {


                });

                test('Usuario Inexistente:', () => {

                    
                });

                test('Campos Incorrectos:', () => {

                    
                });
            });

            describe('Obtener Mazos -> getUserDecks() ', () => {

                test('Usuario Existente:', () => {


                });

                test('Usuario Inexistente:', () => {

                    
                });

                test('Campos Incorrectos:', () => {

                    
                });
            });


        });

        describe('Búsqueda General de varios usuarios. -> searchUsers() ', () => {

            test('Usuarios Existentes:', () => {


            });

            test('Usuarios Inexistentes:', () => {

                
            });

            test('Campos Incorrectos:', () => {

                
            });
        });
    });
    
    describe('Sistema de Mazos. -> checkRelationshipStatus() ', () => {

        describe('Búsqueda de Mazo por ID. -> getDeckById() ', () => {

            test('Mazo Existente:', () => {


            });

            test('Mazo Inexistente:', () => {

                
            });

            test('ID Incorrecto:', () => {

                
            });
        });

        describe('Creacion de Mazos. -> createDeck() ', () => {

            test('Mazo creado con éxito:', () => {


            });

            test('Campos Incorrectos:', () => {

                
            });
        });

        describe('Actualización de Mazos. -> updateDecks() ', () => {

            test('Un solo mazo cambiado con éxito:', () => {


            });

            test('Varios mazos cambiados con éxito:', () => {

                
            });

            test('Campos Incorrectos:', () => {

                
            });
        });

        
    });

    afterAll( () => {


    })

    afterEach( () => {

        
    })

});