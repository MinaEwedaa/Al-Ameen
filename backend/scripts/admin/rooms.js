const { Room } = require('../../src/db/models');
const { toPiastres, toEGP } = require('../../src/utils/money');
const { guard } = require('./guard');

async function createRoom({ roomNumber, roomType, floor, price, halfDayPrice, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'CREATE_ROOM',
    details: { room_number: roomNumber, room_type: roomType, floor, price, half_day_price: halfDayPrice },
  });

  const existing = await Room.findOne({ room_number: String(roomNumber) });
  if (existing) {
    throw new Error(`Room with number '${roomNumber}' already exists.`);
  }

  const pricePerNightPiastres = toPiastres(price);
  const halfDayPricePiastres = halfDayPrice
    ? toPiastres(halfDayPrice)
    : Math.round(pricePerNightPiastres * 0.4);

  const room = await Room.create({
    room_number: String(roomNumber),
    room_type: roomType,
    floor: Number(floor),
    price_per_night: pricePerNightPiastres,
    half_day_price: halfDayPricePiastres,
    status: 'available',
  });

  return {
    room_id: String(room._id),
    room_number: room.room_number,
    room_type: room.room_type,
    floor: room.floor,
    price_per_night: toEGP(room.price_per_night),
    half_day_price: toEGP(room.half_day_price),
    status: room.status,
  };
}

async function setRoom({ roomNumber, price, halfDayPrice, status, by, reason, yes }) {
  await guard({
    by,
    reason,
    yes,
    action: 'SET_ROOM',
    details: { room_number: roomNumber, price, half_day_price: halfDayPrice, status },
  });

  const room = await Room.findOne({ room_number: String(roomNumber) });
  if (!room) {
    throw new Error(`Room with number '${roomNumber}' not found.`);
  }

  if (price !== undefined) {
    room.price_per_night = toPiastres(price);
  }

  if (halfDayPrice !== undefined) {
    room.half_day_price = toPiastres(halfDayPrice);
  }

  if (status !== undefined) {
    room.status = status;
  }

  await room.save();

  return {
    room_id: String(room._id),
    room_number: room.room_number,
    price_per_night: toEGP(room.price_per_night),
    half_day_price: toEGP(room.half_day_price),
    status: room.status,
  };
}

module.exports = {
  createRoom,
  setRoom,
};
