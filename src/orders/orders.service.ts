import { HttpStatus, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateOrderDto, OrderPaginationDto, ChangeOrderStatusDto } from './dto/index';
import { PrismaClient } from '@prisma/client';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NATS_SERVICES } from 'src/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {

  private readonly logger = new Logger('OrderServices')

  constructor(
    @Inject(NATS_SERVICES)
    private readonly client: ClientProxy
  ) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database Connected')
  }



  async create(createOrderDto: CreateOrderDto) {

    try {

      const productsIds = createOrderDto.items.map(item => item.productId)

      const products: any[] = await firstValueFrom(this.client.send(
        { cmd: 'validate_products' }, productsIds)
      )

      const totalAmount = createOrderDto.items.reduce((acum, orderItem) => {
        const price = products.find(prod => prod.id === orderItem.productId).price

        return price * orderItem.quantity;
      }, 0)


      const totalItems = createOrderDto.items.reduce((acum, orderItem) => {
        return acum * orderItem.quantity;
      }, 0)


      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((orderItem) => ({
                productId: orderItem.productId,
                quantity: orderItem.quantity,
                price: products.find(prod => prod.id === orderItem.productId).price
              }))
            }
          }
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            }
          }
        }
      })


      return {
        ...order,
        OrderItem: order.OrderItem.map(item => ({
          ...item,
          name: products.find(p => p.id === item.productId)
        }))
      }
    } catch (error) {
      throw new RpcException({
        error,
        status: HttpStatus.BAD_REQUEST,
        message: ' Check logs'
      })
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {

    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status
      }
    })

    const currentPage = orderPaginationDto.page
    const perPega = orderPaginationDto.limit

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPega,
        take: perPega,
        where: {
          status: orderPaginationDto.status
        }
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPega)
      }
    }
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true
          }
        }
      }
    })

    if (!order) throw new RpcException({
      status: HttpStatus.NOT_FOUND,
      message: `Order with id ${id} not found`
    })


    const productsId = order.OrderItem.map((orderItem) => orderItem.productId)

    const products: any[] = await firstValueFrom(this.client.send(
      { cmd: 'validate_products' }, productsId)
    )

    return {
      ...order,
      OrderItem: order.OrderItem.map( orderItem => ({
        ...orderItem,
        name: products.find( p => p.id === orderItem.productId).name
      }))
    }
  }


  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {

    const { id, status } = changeOrderStatusDto

    const order = await this.findOne(id)

    if (order.status === status) {
      return order
    }

    return this.order.update({
      where: { id },
      data: { status }
    }
    )
  }
}
