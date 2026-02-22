export const Playbook = {
    offense: [
        {
            name: "Run",
            type: "run",
            routes: [
                { position: "QB", action: "handoff" },
                { position: "RB", action: "run_forward" },
                { position: "WR1", action: "block" },
                { position: "WR2", action: "block" },
            ]
        },
        {
            name: "Short Pass",
            type: "pass",
            routes: [
                { position: "WR1", action: "slant" }, // cuts inside short
                { position: "WR2", action: "curl" },  // runs out and stops
                { position: "RB", action: "flat" },   // runs to the sideline
            ]
        },
        {
            name: "Deep Pass",
            type: "pass",
            routes: [
                { position: "WR1", action: "fly" }, // runs straight deep
                { position: "WR2", action: "post" }, // runs deep and cuts middle
                { position: "RB", action: "block" },
            ]
        }
    ],
    defense: [
        {
            name: "Man",
            type: "man",
            assignments: "cover_closest"
        },
        {
            name: "Zone",
            type: "zone",
            assignments: "drop_back"
        },
        {
            name: "Blitz",
            type: "blitz",
            assignments: "rush_qb"
        }
    ]
};
