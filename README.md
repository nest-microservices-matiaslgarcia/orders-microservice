<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

# Order Microservice


## Dev

1. Clonar el repositorio
2. Instalar las dependencias
3. Crear un archivo `.env` basado en el `.env.template`
4. Ejecutar migracion de prisma `npx prisma migrate dev`
5. Ejecutar `npm run start:dev`



# Nats

Ejecutar la imagen y correr el contenedor del servidor nats
```
docker run -d --name nats-main -p 4222:4222 -p 8222:8222 nats 
```