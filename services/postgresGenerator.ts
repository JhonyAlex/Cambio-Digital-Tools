
/**
 * SERVICE DEPRECATED
 * 
 * The External Database (IONOS/PostgreSQL) integration features have been removed from the application.
 * This file is kept as a placeholder to prevent build errors from dangling references 
 * until they are fully cleaned up in a future refactor.
 */

export const generateMigrationScript = async (): Promise<string> => {
  return "-- Feature Removed";
};

export const downloadSqlFile = (content: string, filename: string = 'backup.sql') => {
    console.warn("Feature removed");
};
