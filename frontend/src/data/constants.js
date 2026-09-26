export const NPCS = {
  mira: {
    id: "mira",
    name: "Mira",
    role: "Tavern Keeper",
    icon: "🍺",
    color: "var(--mira-color)",
    desc: "The Tavern Keeper — warm, protective, and full of rumours.",
    greeting: "Welcome to the Whispering Willow Tavern, traveller. Come by the hearth—what brings you through Haven?"
  },
  rowan: {
    id: "rowan",
    name: "Rowan",
    role: "Guard Captain",
    icon: "🛡️",
    color: "var(--rowan-color)",
    desc: "The Guard Captain — duty-bound, suspicious of strangers.",
    greeting: "Halt. State your name and business in Haven. The guard doesn't take kindly to wanderers near the forest edge."
  },
  aldric: {
    id: "aldric",
    name: "Aldric",
    role: "Blacksmith",
    icon: "🔨",
    color: "var(--aldric-color)",
    desc: "The Blacksmith — gruff and honest, skilled with iron.",
    greeting: "Careful around the forge. If you need ironwork done or blades sharpened, speak up."
  },
  elian: {
    id: "elian",
    name: "Elian",
    role: "Mage",
    icon: "🔮",
    color: "var(--elian-color)",
    desc: "The Mage — wise and secretive, guardian of arcane truths.",
    greeting: "The arcane runes hum with an uneasy resonance today. What query brings you to my study?"
  }
};

export const ITEM_ICONS = {
  gold: "🪙",
  torch: "🔦",
  potion: "🧪",
  iron: "⚙️",
  steel: "🔩",
  sword: "⚔️",
  iron_sword: "⚔️",
  shield: "🛡️",
  ale: "🍺",
  bread: "🍞",
  spell_scroll: "📜",
  barrier_shard: "💠",
  candle: "🕯️"
};

export const HOTSPOTS = [
  {
    id: "board",
    name: "📜 Village Notice Board",
    x: 390,
    y: 110,
    radius: 24,
    title: "📜 Haven Sentry Decrees",
    desc: "<b>Curfew Notice:</b> All villagers must remain behind the palisade after dusk.<br/><br/><b>Bounty:</b> Reports of corrupted beasts at the Forbidden Forest perimeter. Report strange whispers to Captain Rowan."
  },
  {
    id: "well",
    name: "⛲ Central Stone Well",
    x: 390,
    y: 185,
    radius: 30,
    title: "⛲ Ancient Haven Spring",
    desc: "Crystal-clear mountain water flows through ancient stone carved with protective runes. Tossing a copper coin yields a shimmering ripple."
  },
  {
    id: "gate",
    name: "🛡️ Forest Portcullis",
    x: 640,
    y: 55,
    radius: 28,
    title: "🛡️ The Forbidden Forest Gate",
    desc: "Massive oak timbers bound in rusted black iron. Heavy chains lock the portcullis shut. Thick purple mist billows through the iron grating."
  },
  {
    id: "barrier",
    name: "🔮 Arcane Rift Tear",
    x: 660,
    y: 275,
    radius: 32,
    title: "🔮 Frayed Boundary Seal",
    desc: "The magical ward protecting Haven from the wilderness. The air smells of ozone and burning lavender. Violet lightning fractures the air."
  }
];
