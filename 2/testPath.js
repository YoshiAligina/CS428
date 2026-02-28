const Board = require('./src/Board.js');
const Utils = require('./src/Utils.js');
const Tile = require('./src/Tile.js');

const board = new Board(10,10);
board.generate();
let pair=null;
for(let y=0;y<10;y++){
  for(let x=0;x<10;x++){
    const t=board.getTile(x,y);
    if(t.type===Tile.TYPES.BUILDING){
      const dirs=[{dx:1,dy:0},{dx:0,dy:1},{dx:-1,dy:0},{dx:0,dy:-1}];
      for(const d of dirs){
        const nx=x+d.dx, ny=y+d.dy;
        if(board.isValidPosition(nx,ny)){
          const u=board.getTile(nx,ny);
          if(u.type===Tile.TYPES.BUILDING){ pair={a:{x,y},b:{x:nx,y:ny}}; break; }
        }
      }
      if(pair) break;
    }
  }
  if(pair) break;
}
console.log('adjacent buildings',pair);
if(pair){
  const path=Utils.findPath(board,pair.a,pair.b);
  console.log('path from building to building',path);
}
