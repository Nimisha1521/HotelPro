// 20 demo room types, one physical room each (so one room can never hold two overlapping bookings). Prices in INR. Demo content only.
const WIFI = 'WiFi,AC,TV';
const ROOMS = [
 ['101','Standard Single Room','Standard',2499,1,'Single',1,16,WIFI+',Work desk'],
 ['102','Standard Double Room','Standard',3299,2,'Double',1,20,WIFI+',Tea/coffee maker'],
 ['103','Deluxe Double Room','Deluxe',4299,2,'Double',1,24,WIFI+',Minibar'],
 ['104','Premium King Room','Premium',5499,2,'King',1,28,WIFI+',Minibar,Breakfast'],
 ['105','Superior Twin Room','Deluxe',4599,2,'Twin',2,26,WIFI+',Work desk'],
 ['106','Executive Room','Premium',5999,2,'King',1,30,WIFI+',Lounge access,Breakfast'],
 ['107','Business Room','Premium',5199,2,'Queen',1,27,WIFI+',Work desk,Printer access'],
 ['108','Garden View Room','Deluxe',4499,2,'Queen',1,25,WIFI+',Garden view'],
 ['109','City View Room','Deluxe',4799,2,'Queen',1,25,WIFI+',City view'],
 ['110','Balcony Room','Deluxe',4999,3,'Queen',1,28,WIFI+',Balcony'],
 ['201','Family Room','Family',6499,4,'Double',2,36,WIFI+',Extra seating'],
 ['202','Family Suite','Family',8999,5,'King',3,48,WIFI+',Kitchenette,Breakfast'],
 ['203','Junior Suite','Suite',7499,3,'King',1,40,WIFI+',Sitting area,Minibar'],
 ['204','Executive Suite','Suite',10999,3,'King',1,52,WIFI+',Lounge access,Bathtub'],
 ['205','Luxury Suite','Suite',13999,3,'King',1,60,WIFI+',Bathtub,Minibar,Breakfast'],
 ['301','Honeymoon Suite','Suite',12499,2,'King',1,50,WIFI+',Bathtub,Balcony'],
 ['302','Presidential Suite','Suite',34999,4,'King',2,120,WIFI+',Living room,Dining area,Butler'],
 ['303','Accessible Room','Standard',3499,2,'Double',1,30,WIFI+',Step-free access,Roll-in shower'],
 ['304','Pool View Room','Deluxe',5299,3,'Queen',1,28,WIFI+',Pool view,Balcony'],
 ['401','Penthouse Suite','Suite',44999,4,'King',2,150,WIFI+',Terrace,Skyline view,Butler']];
function seedRooms(db) {
  const up = db.prepare(`INSERT INTO rooms(number,name,type,price,capacity,bed_type,beds,size_sqm,amenities,description) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(number) DO UPDATE SET name=excluded.name,type=excluded.type,price=excluded.price,capacity=excluded.capacity,
    bed_type=excluded.bed_type,beds=excluded.beds,size_sqm=excluded.size_sqm,amenities=excluded.amenities,description=excluded.description`);
  for (const [n, name, type, price, cap, bed, beds, size, am] of ROOMS)
    up.run(n, name, type, price, cap, bed, beds, size, am, `${size} m² ${name.toLowerCase()} with ${beds} ${bed.toLowerCase()} bed${beds > 1 ? 's' : ''}. Sample catalogue entry.`);
}
module.exports = { seedRooms, ROOMS };
