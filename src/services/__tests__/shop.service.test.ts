import 'dotenv/config';
import { prisma } from '../../infrastructure/prisma';
import { ShopService } from '../../services/shop.service';
import { ShopRedisRepository } from '../../repositories/shop.repository';
import { Board_Type } from '@prisma/client';