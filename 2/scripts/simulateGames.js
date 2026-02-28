const GAME_CONSTANTS = require('../src/Constants');

global.window = { GAME_CONSTANTS };

const Utils = require('../src/Utils');
global.Utils = Utils;

const Tile = require('../src/Tile');
global.Tile = Tile;

const Agent = require('../src/Agent');
global.Agent = Agent;

const Board = require('../src/Board');
const TurnManager = require('../src/TurnManager');

function buildAgents(board, numAgents = 4) {
    const homes = board.specialLocations.homes;
    const offices = board.specialLocations.offices;

    if (!homes.length || !offices.length) {
        return [];
    }

    const agents = [];
    for (let i = 0; i < numAgents; i++) {
        const home = homes[i % homes.length];
        const office = offices[i % offices.length];
        const agent = new Agent(
            `agent_${i + 1}`,
            { x: home.x, y: home.y },
            { x: office.x, y: office.y },
            '#4da6ff',
            board
        );
        agent.maxTurns = GAME_CONSTANTS.TURN_LIMIT;
        agent.turnsRemaining = GAME_CONSTANTS.TURN_LIMIT;
        agents.push(agent);
    }

    return agents;
}

function runSingleGame() {
    const board = new Board();
    const generated = board.generate();
    if (!generated) {
        return { successRate: 0, agentsCompleted: 0, totalAgents: 0 };
    }

    const agents = buildAgents(board);
    if (!agents.length) {
        return { successRate: 0, agentsCompleted: 0, totalAgents: 0 };
    }

    const turnManager = new TurnManager(agents, board, {
        maxTurns: GAME_CONSTANTS.TURN_LIMIT,
        accidentProbability: GAME_CONSTANTS.ACCIDENT_PROBABILITY,
    });

    turnManager.start();
    if (turnManager.rotateSpecialAgent) {
        turnManager.rotateSpecialAgent();
    }

    while (turnManager.gameRunning && !turnManager.gameFinished) {
        turnManager.executeTurn();
    }

    const agentsCompleted = agents.filter(agent => agent.status === Agent.STATUS.ARRIVED).length;
    const totalAgents = agents.length;
    const successRate = totalAgents > 0 ? agentsCompleted / totalAgents : 0;

    return { successRate, agentsCompleted, totalAgents };
}

function runBatch(totalGames = 20) {
    let completed = 0;
    let totalAgents = 0;

    for (let i = 0; i < totalGames; i++) {
        const result = runSingleGame();
        completed += result.agentsCompleted;
        totalAgents += result.totalAgents;
    }

    const successRate = totalAgents > 0 ? completed / totalAgents : 0;
    const percent = Math.round(successRate * 1000) / 10;

    console.log(`Simulated ${totalGames} games.`);
    console.log(`Agents completed: ${completed}/${totalAgents} (${percent}%)`);

    if (successRate < 0.5) {
        console.log('Result: Too hard. Recommend increasing TURN_LIMIT to 35.');
    } else if (successRate > 0.7) {
        console.log('Result: Too easy. Recommend decreasing TURN_LIMIT to 25.');
    } else {
        console.log('Result: Within target range (50-70%).');
    }
}

runBatch(20);
