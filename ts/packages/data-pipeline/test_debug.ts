import { readFileSync } from "fs";
import { join } from "path";

interface Card {
  type: "pokemon" | "energy" | "trainer";
  id: string;
  name: string;
}

const cardsPath = join(__dirname, "../../ui/public/cards.json");
const data = JSON.parse(readFileSync(cardsPath, "utf-8"));
const baseCards = data.cards as Card[];

console.log("Base cards count:", baseCards.length);
console.log("Base cards:");
baseCards.forEach(c => console.log(`  ${c.id} -> ${c.name}`));

// Check for duplicates in base cards
const baseIds = baseCards.map(c => c.id);
const dupes = baseIds.filter((id, idx) => baseIds.indexOf(id) !== idx);
console.log("Duplicates in base:", dupes);
