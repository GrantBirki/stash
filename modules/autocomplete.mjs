import gameData from "./game-data.mjs";
import progress from '../modules/progress-shard.mjs';
import { getCommandLocalizations } from "./translations.mjs";

const caches = {
    default: async lang => {
        return gameData.items.getAll(lang).then(items => items.map(item => item.name).sort());
    },
    barter: async lang => {
        return gameData.items.getAll(lang).then(items => items.filter(item => item.bartersFor.length > 0 || item.bartersUsing.length > 0).reduce((names, item) => {
            if (!names.includes(item.name)) {
                names.push(item.name);
            }
            return names;
        }, []).sort());
    },
    craft: async lang => {
        return gameData.items.getAll(lang).then(items => items.filter(item => item.craftsFor.length > 0 || item.craftsUsing.length > 0).reduce((names, item) => {
            if (!names.includes(item.name)) {
                names.push(item.name);
            }
            return names;
        }, []).sort());
    },
    key: async lang => {
        return gameData.items.getKeys(lang).then(items => items.map(item => item.name).sort());
    },
    ammo: async lang => {
        return gameData.items.getAmmo(lang).then(items => items.map(item => item.name).sort());
    },
    stim: async lang => {
        return gameData.items.getStims(lang).then(items => items.map(item => item.name).sort());
    },
    hideout: async lang => {
        const stations = await gameData.hideout.getAll(lang).then(stations => stations.reduce((all, current) => {
            all.push(current.name);
            return all;
        }, []).sort());
        const allOption = allLocalizations[lang] || allLocalizations['en-US'];
        stations.push(allOption);
        return stations;
    },
    quest: async lang => {
        return gameData.tasks.getAll(lang).then(tasks => tasks.map(t => t.name).sort());
    },
};

const allLocalizations = getCommandLocalizations('all_desc');

async function autocomplete(interaction) {
    let searchString;
    try {
        searchString = interaction.options.getString('name');
    } catch (getError) {
        console.error(getError);
    }
    const { lang, gameMode } = await progress.getInteractionSettings(interaction);
    let cacheKey = interaction.commandName;
    if (cacheKey === 'player') {
        const nameResults = await gameData.profiles.search(interaction.options.getString('account'), {gameMode});
        const names = [];
        for (const id in nameResults) {
            names.push({name: nameResults[id], value: id});
        }
        return names;
    }
    if (cacheKey === 'progress' && interaction.options.getSubcommand() === 'hideout') {
        cacheKey = interaction.options.getSubcommand();
        searchString = interaction.options.getString('station');
    }
    const cacheFunction = caches[cacheKey] || caches.default;
    const nameCache = await cacheFunction(lang);

    if (cacheKey === 'ammo') {
        return nameCache.filter(name => name.toLowerCase().replace(/\./g, '').includes(searchString.toLowerCase().replace(/\./g, '')));
    }

    return nameCache.filter(name => name.toLowerCase().includes(searchString.toLowerCase()));
};

export default autocomplete;
