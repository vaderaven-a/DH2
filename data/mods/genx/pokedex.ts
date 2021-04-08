export const Pokedex: {[speciesid: string]: SpeciesData} = {
	folovo: {
		num: 1001,
		name: "Folovo",
		types: ["Grass"],
		baseStats: {hp: 40, atk: 67, def: 40, spa: 48, spd: 40, spe: 75},
		abilities: {0: "Overgrow", H: "Swift Swim"},
		weightkg: 5,
		evos: ["Sworchid"],
	},
	sworchid: {
		num: 1002,
		name: "Sworchid",
		types: ["Grass", "Fighting"],
		baseStats: {hp: 60, atk: 97, def: 49, spa: 70, spd: 49, spe: 95},
		abilities: {0: "Overgrow", H: "Swift Swim"},
		weightkg: 14,
		prevo: "Folovo",
		evos: ["Esplada"],
	},
	esplada: {
		num: 1003,
		name: "Esplada",
		types: ["Grass", "Fighting"],
		baseStats: {hp: 80, atk: 112, def: 69, spa: 80, spd: 69, spe: 120},
		abilities: {0: "Overgrow", H: "Swift Swim"},
		weightkg: 26,
		prevo: "Sworchid",
	},
	peepin: {
		num: 1004,
		name: "Peepin",
		types: ["Fire"],
		baseStats: {hp: 40, atk: 45, def: 60, spa: 70, spd: 45, spe: 50},
		abilities: {0: "Blaze", H: "Punk Rock"},
		weightkg: 1.7,
		evos: ["Scareech"],
	},
	scareech: {
		num: 1005,
		name: "Scareech",
		types: ["Fire", "Flying"],
		baseStats: {hp: 50, atk: 61, def: 80, spa: 94, spd: 70, spe: 65},
		abilities: {0: "Blaze", H: "Punk Rock"},
		weightkg: 10,
		prevo: "Peepin",
		evos: ["Macawphony"],
	},
	macawphony: {
		num: 1006,
		name: "Macawphony",
		types: ["Fire", "Flying"],
		baseStats: {hp: 70, atk: 71, def: 100, spa: 124, spd: 80, spe: 85},
		abilities: {0: "Blaze", H: "Punk Rock"},
		weightkg: 30,
		prevo: "Scareech",
	},
	pescafin: {
		num: 1007,
		name: "Pescafin",
		types: ["Water"],
		baseStats: {hp: 50, atk: 61, def: 72, spa: 41, spd: 40, spe: 46},
		abilities: {0: "Torrent", H: "Rock Head"},
		weightkg: 6,
		evos: ["Pedrowana"],
	},
	pedrowana: {
		num: 1008,
		name: "Pedrowana",
		types: ["Water", "Rock"],
		baseStats: {hp: 70, atk: 81, def: 92, spa: 61, spd: 50, spe: 66},
		abilities: {0: "Torrent", H: "Rock Head"},
		weightkg: 20,
		prevo: "Pescafin",
		evos: ["Arapaitan"],
	},
	arapaitan: {
		num: 1009,
		name: "Arapaitan",
		types: ["Water", "Rock"],
		baseStats: {hp: 90, atk: 101, def: 122, spa: 81, spd: 60, spe: 76},
		abilities: {0: "Torrent", H: "Rock Head"},
		weightkg: 80,
		prevo: "Pedrowana",
	},
	brazube: {
		num: 1010,
		name: "Brazube",
		types: ["Normal", "Poison"],
		baseStats: {hp: 55, atk: 50, def: 60, spa: 20, spd: 45, spe: 20},
		abilities: {0: "Poison Point", 1: "Rough Skin", H: "Poison Touch"},
		weightkg: 1,
		evos: ["Brazupine"],
	},
	brazupine: {
		num: 1011,
		name: "Brazupine",
		types: ["Normal", "Poison"],
		baseStats: {hp: 80, atk: 80, def: 100, spa: 40, spd: 70, spe: 80},
		abilities: {0: "Poison Point", 1: "Rough Skin", H: "Poison Touch"},
		weightkg: 20,
		prevo: "Brazube",
	},
	plumgall: {
		num: 1012,
		name: "Plumgall",
		types: ["Flying"],
		baseStats: {hp: 41, atk: 52, def: 44, spa: 32, spd: 37, spe: 39},
		abilities: {0: "Early Bird", 1: "Rattled", H: "Fluffy"},
		weightkg: 25,
		evos: ["Secrehen"],
	},
	secrehen: {
		num: 1013,
		name: "Secrehen",
		types: ["Flying"],
		baseStats: {hp: 51, atk: 77, def: 64, spa: 42, spd: 52, spe: 59},
		abilities: {0: "Early Bird", 1: "Rattled", H: "Fluffy"},
		weightkg: 25,
		prevo: "Plumgall",
		evos: ["Mourhen"],
	},
	mourhen: {
		num: 1014,
		name: "Mourhen",
		types: ["Flying", "Ghost"],
		baseStats: {hp: 71, atk: 122, def: 94, spa: 52, spd: 72, spe: 89},
		abilities: {0: "Infiltrator", 1: "Unnerve", H: "Fluffy"},
		weightkg: 25,
		prevo: "Secrehen",
	},
	citruff: {
		num: 1015,
		name: "Citruff",
		types: ["Dark", "Grass"],
		baseStats: {hp: 30, atk: 40, def: 30, spa: 70, spd: 40, spe: 40},
		abilities: {0: "Cute Charm", 1: "Harvest", H: "Natural Cure"},
		weightkg: 25,
		evos: ["Citrark"],
	},
	citrark: {
		num: 1016,
		name: "Citrark",
		types: ["Dark", "Grass"],
		baseStats: {hp: 75, atk: 70, def: 60, spa: 125, spd: 70, spe: 80},
		abilities: {0: "Cute Charm", 1: "Harvest", H: "Natural Cure"},
		weightkg: 25,
		prevo: "Citruff",
	},
	civiliant: {
		num: 1017,
		name: "Civiliant",
		types: ["Bug"],
		baseStats: {hp: 35, atk: 20, def: 30, spa: 20, spd: 30, spe: 50},
		abilities: {0: "Swarm", H: "Run Away"},
		weightkg: 2.5,
		evos: ["Escudant"],
	},
	escudant: {
		num: 1018,
		name: "Escudant",
		types: ["Bug", "Fighting"],
		baseStats: {hp: 60, atk: 40, def: 75, spa: 40, spd: 75, spe: 55},
		abilities: {0: "Swarm", H: "Bulletproof"},
		weightkg: 9,
		prevo: "Civiliant",
		evos: ["Formigavor", "Formigavel"],
	},
	formigavor: {
		num: 1019,
		name: "Formigavor",
		types: ["Bug", "Fighting"],
		baseStats: {hp: 75, atk: 60, def: 80, spa: 110, spd: 95, spe: 90},
		abilities: {0: "Swarm", H: "Compound Eyes"},
		weightkg: 55,
		prevo: "Escudant",
	},
	formigavel: {
		num: 1020,
		name: "Formigavel",
		types: ["Bug", "Fighting"],
		baseStats: {hp: 75, atk: 110, def: 95, spa: 60, spd: 80, spe: 90},
		abilities: {0: "Swarm", H: "Skill Link"},
		weightkg: 70,
		prevo: "Escudant",
	},
	souarente: {
		num: 1021,
		name: "Souarente",
		types: ["Grass"],
		baseStats: {hp: 35, atk: 40, def: 80, spa: 55, spd: 70, spe: 30},
		abilities: {0: "Volt Absorb", H: "Solar Power"},
		weightkg: 3,
		evos: ["Pequetal"],
	},
	pequetal: {
		num: 1022,
		name: "Pequetal",
		types: ["Grass", "Electric"],
		baseStats: {hp: 55, atk: 50, def: 85, spa: 90, spd: 90, spe: 40},
		abilities: {0: "Volt Absorb", H: "Solar Power"},
		weightkg: 7,
		prevo: "Souarente",
		evos: ["Florapago"],
	},
	florapago: {
		num: 1023,
		name: "Florapago",
		types: ["Grass", "Electric"],
		baseStats: {hp: 85, atk: 60, def: 100, spa: 110, spd: 105, spe: 50},
		abilities: {0: "Volt Absorb", H: "Solar Power"},
		weightkg: 30,
		prevo: "Pequetal",
	},
	alumane: {
		num: 1024,
		name: "Alumane",
		types: ["Steel"],
		baseStats: {hp: 35, atk: 55, def: 65, spa: 30, spd: 35, spe: 75},
		abilities: {0: "Technician", 1: "Volt Absorb", H: "Light Metal"},
		weightkg: 10,
		evos: ["Silicyon"],
	},
	silicyon: {
		num: 1025,
		name: "Silicyon",
		types: ["Steel"],
		baseStats: {hp: 55, atk: 100, def: 115, spa: 50, spd: 60, spe: 130},
		abilities: {0: "Technician", 1: "Volt Absorb", H: "Light Metal"},
		weightkg: 30,
		prevo: "Alumane",
	},
	oncuja: {
		num: 1026,
		name: "Oncuja",
		types: ["Grass", "Ghost"],
		baseStats: {hp: 65, atk: 103, def: 63, spa: 61, spd: 81, spe: 121},
		abilities: {0: "Infiltrator", 1: "Insomnia", H: "Grass Pelt"},
		weightkg: 30,
	},
	oricorio: {
		num: 741,
		name: "Oricorio",
		baseForme: "Baile",
		types: ["Fire", "Flying"],
		genderRatio: {M: 0.25, F: 0.75},
		baseStats: {hp: 75, atk: 70, def: 70, spa: 98, spd: 70, spe: 93},
		abilities: {0: "Dancer"},
		heightm: 0.6,
		weightkg: 3.4,
		color: "Red",
		eggGroups: ["Flying"],
		otherFormes: ["Oricorio-Pom-Pom", "Oricorio-Pa'u", "Oricorio-Sensu", "Oricorio-Brazdo"],
		formeOrder: ["Oricorio", "Oricorio-Pom-Pom", "Oricorio-Pa'u", "Oricorio-Sensu", "Oricorio-Brazdo"],
	},
	oricoriobrazdo: {
		num: 741,
		name: "Oricorio-Brazdo",
		baseSpecies: "Oricorio",
		forme: "Brazdo",
		types: ["Fighting", "Flying"],
		genderRatio: {M: 0.25, F: 0.75},
		baseStats: {hp: 65, atk: 98, def: 70, spa: 70, spd: 70, spe: 103},
		abilities: {0: "Dancer"},
		heightm: 0.6,
		weightkg: 3.4,
		color: "Brown",
		eggGroups: ["Flying"],
	},
	sapeetle: {
		num: 1027,
		name: "Sapeetle",
		types: ["Bug"],
		baseStats: {hp: 50, atk: 60, def: 100, spa: 35, spd: 55, spe: 40},
		abilities: {0: "Shell Armor", 1: "Sap Sipper", H: "Oblivious"},
		weightkg: 10,
		evos: ["Silicyon"],
	},
	carapex: {
		num: 1028,
		name: "Carapex",
		types: ["Bug", "Flying"],
		baseStats: {hp: 70, atk: 90, def: 140, spa: 55, spd: 80, spe: 70},
		abilities: {0: "Shell Armor", 1: "Sap Sipper", H: "Wind Blaster"},
		weightkg: 30,
		prevo: "Sapeetle",
	},
	parasbrazdo: {
		num: 46,
		name: "Paras-Brazdo",
		baseSpecies: "Paras",
		forme: "Brazdo",
		types: ["Psychic", "Bug"],
		baseStats: {hp: 35, atk: 45, def: 55, spa: 70, spd: 55, spe: 25},
		abilities: {0: "Keen Eye", 1: "Insomnia", H: "Analytic"},
		weightkg: 5.4,
		evos: ["Parasect-Brazdo"],
	},
	parasectbrazdo: {
		num: 47,
		name: "Parasect-Brazdo",
		baseSpecies: "Parasect",
		forme: "Brazdo",
		types: ["Psychic", "Poison"],
		baseStats: {hp: 60, atk: 60, def: 80, spa: 95, spd: 80, spe: 30},
		abilities: {0: "Compound Eyes", 1: "Piercing Vision", H: "Analytic"},
		weightkg: 29.5,
		prevo: "Paras-Brazdo",
		evos: ["Parascend"],
	},
	parascend: {
		num: 1029,
		name: "Parascend",
		types: ["Psychic", "Poison"],
		baseStats: {hp: 80, atk: 70, def: 80, spa: 140, spd: 110, spe: 40},
		abilities: {0: "Compound Eyes", 1: "Piercing Vision", H: "Analytic"},
		weightkg: 29.5,
		prevo: "Parasect-Brazdo",
	},
	paras: {
		inherit: true,
		otherFormes: ["Paras-Brazdo"],
		formeOrder: ["Paras", "Paras-Brazdo"],
	},
	parasect: {
		inherit: true,
		otherFormes: ["Parasect-Brazdo"],
		formeOrder: ["Parasect", "Parasect-Brazdo"],
	},
	rikomoco: {
		num: 1030,
		name: "Rikomoco",
		types: ["Electric", "Rock"],
		baseStats: {hp: 57, atk: 41, def: 87, spa: 93, spd: 56, spe: 97},
		abilities: {0: "Pickup", 1: "Stone House", H: "Motor Drive"},
		weightkg: 29.5,
	},
	jujitzu: {
		num: 1031,
		name: "Jujitzu",
		types: ["Fighting"],
		baseStats: {hp: 80, atk: 110, def: 70, spa: 50, spd: 70, spe: 95},
		abilities: {0: "Long Reach", H: "Patience"},
		weightkg: 29.5,
	},
	humbat: {
		num: 1032,
		name: "Humbat",
		types: ["Normal", "Flying"],
		baseStats: {hp: 35, atk: 35, def: 45, spa: 60, spd: 45, spe: 60},
		abilities: {0: "Frisk", 1: "Oblivious", H: "Hustle"},
		weightkg: 29.5,
		evos: ["Sensat"],
	},
	sensat: {
		num: 1033,
		name: "Sensat",
		types: ["Psychic", "Flying"],
		baseStats: {hp: 50, atk: 45, def: 50, spa: 80, spd: 65, spe: 90},
		abilities: {0: "Frisk", 1: "Oblivious", H: "Tinted Lens"},
		weightkg: 29.5,
		prevo: "Humbat",
		evos: ["Echologos"],
	},
	echologos: {
		num: 1034,
		name: "Echologos",
		types: ["Psychic", "Flying"],
		baseStats: {hp: 60, atk: 60, def: 70, spa: 100, spd: 90, spe: 110},
		abilities: {0: "Frisk", 1: "Oblivious", H: "Tinted Lens"},
		weightkg: 29.5,
		prevo: "Sensat",
	},
	topaca: {
		num: 1035,
		name: "Topaca",
		types: ["Ground", "Rock"],
		baseStats: {hp: 55, atk: 76, def: 51, spa: 43, spd: 45, spe: 70},
		abilities: {0: "Sand Veil", 1: "Solid Rock", H: "Clear Body"},
		weightkg: 29.5,
		evos: ["Pacavarice"],
	},
	pacavarice: {
		num: 1036,
		name: "Pacavarice",
		types: ["Ground", "Rock"],
		baseStats: {hp: 75, atk: 116, def: 71, spa: 63, spd: 65, spe: 110},
		abilities: {0: "Sand Force", 1: "Solid Rock", H: "Clear Body"},
		weightkg: 29.5,
		prevo: "Topaca",
	},
	gelobite: {
		num: 1037,
		name: "Gelobite",
		types: ["Ice", "Ground"],
		baseStats: {hp: 35, atk: 30, def: 30, spa: 55, spd: 40, spe: 60},
		abilities: {0: "Storm Drain", 1: "Ice Body", H: "Hydration"},
		weightkg: 1.5,
		evos: ["Lagelto"],
	},
	lagelto: {
		num: 1038,
		name: "Lagelto",
		types: ["Ice", "Ground"],
		baseStats: {hp: 60, atk: 50, def: 45, spa: 90, spd: 60, spe: 95},
		abilities: {0: "Storm Drain", 1: "Ice Body", H: "Hydration"},
		weightkg: 22,
		prevo: "Gelobite",
		evos: ["Gelomandra"],
	},
	gelomandra: {
		num: 1039,
		name: "Gelomandra",
		types: ["Ice", "Ground"],
		baseStats: {hp: 80, atk: 65, def: 60, spa: 120, spd: 75, spe: 110},
		weightkg: 50,
		prevo: "Lagelto",
	},
};
