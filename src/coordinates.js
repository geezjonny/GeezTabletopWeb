export const LEVEL_HEIGHT = 3;
export const span = size => ({tiny:1, small:1, medium:1, large:2, huge:3, gargantuan:4}[size] || 1);
export const round5 = n => Math.round(n * 1e5) / 1e5;
// Godot roundi rounds ties away from zero (unlike JS for negative ties).
export const roundCell = n => Math.sign(n) * Math.floor(Math.abs(n) + .5);
export function tokenCell(record, sizeName, origin, size) {
  const half = span(sizeName) / 2;
  return {x:roundCell(record.x * size.x - half) + origin.x, y:roundCell(record.y * size.y - half) + origin.y};
}
export function tokenRecord(cell, sizeName, origin, size, f = 0, existing = {}) {
  const half = span(sizeName) / 2;
  return {...existing, x:round5((cell.x - origin.x + half) / Math.max(1,size.x)), y:round5((cell.y - origin.y + half) / Math.max(1,size.y)), f};
}
export const centre = (record, size) => ({x:record.x*size.x, y:record.y*size.y});
export const worldPoint = (x,y,f=0,elevation=0) => ({x, y:f*LEVEL_HEIGHT+elevation, z:y});
export const cellKey = (x,y) => `${Math.floor(x)}_${Math.floor(y)}`;
export const heightAt = (floor,x,y) => Number(floor?.elevation?.[cellKey(x,y)] || 0);
export const yaw = degrees => -degrees*Math.PI/180;
