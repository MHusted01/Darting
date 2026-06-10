// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_amusing_hellion.sql';
import m0001 from './0001_create_game_tables.sql';
import m0002 from './0002_repair_game_tables.sql';
import m0003 from './0003_tiny_warbound.sql';
import m0004 from './0004_opposite_trish_tilby.sql';
import m0005 from './0005_free_firebrand.sql';
import m0006 from './0006_phase9_tournament_session_columns.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006
    }
  }
  