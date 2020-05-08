#!/usr/bin/env node

const cache = require("persistent-cache");
const globals = cache();
const prog = require("caporal");
const createApiCmd = require("./lib/createApi");
const createCmd = require("./lib/create");
const createGeneratorCmd = require("./lib/createGenerator");
const createModelCmd = require("./lib/createModel");
const createPageCmd = require("./lib/createPage");
const exportProjectCommand = require("./lib/exportProject");
const generateCmd = require("./lib/generate");
const getEndpointCmd = require("./lib/getEndpoint");
const getProjectUrlCmd = require("./lib/getProjectUrl");
const getTemplates = require("./lib/getTemplates");
const getUserCmd = require("./lib/getUser");
const importDbCmd = require("./lib/importDb");
const importGeneratorCmd = require("./lib/importGenerator");
const loginCmd = require("./lib/login");
const logoutCmd = require("./lib/logout");
const offlineCommandBuilder = require("./lib/offline").offlineCommandBuilder;
const openCmd = require("./lib/open");
const publishGeneratorCmd = require("./lib/publishGenerator");
const reloadGeneratorCmd = require("./lib/reloadGenerator");
const saveGeneratorCmd = require("./lib/saveGenerator");
const setEndpointCmd = require("./lib/setEndpoint");
const webOpenCmd = require("./lib/webOpen");
const config = require("./utils/config");

prog
  .version("2.0.6")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)

  // start
  .command("login", "Log in into Skaffolder")
  .action(loginCmd)
  .command("logout", "Log out from Skaffolder\n\n---- Create Project ----\n")
  .action(logoutCmd)

  .command("new", "Create a new Skaffolder project")
  .argument("[name]", "Name of the project to create", null, "")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)
  .option("-i, --import <file>", "Convert an OpenAPI 3.0 file in a Skaffolder project", null, false, false)
  .option("-f, --frontend <templateName>", "Template frontend language", null, false, false)
  .option("-b, --backend <templateName>", "Template backend language", null, false, false)
  .action(offlineCommandBuilder(createCmd))

  .command("open", "Open a Skaffolder project")
  .argument("[id project]", "Id of the project to open", null, "")
  .argument("[id generator]", "Id of the generator to open", null, "")
  .action(openCmd)

  .command("generate", "Generate Skaffolder Template\n\n---- Manage Project ----\n")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)
  .action(offlineCommandBuilder(generateCmd))

  // manage
  .command("add page", "Create a new page in Skaffolder project")
  .argument("[name]", "Name of the page", null, "")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)
  .action(offlineCommandBuilder(createPageCmd))

  .command("add model", "Create a new model in Skaffolder project")
  .argument("[name]", "Name of the model", null, "")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)
  .action(offlineCommandBuilder(createModelCmd))

  .command("add api", "Create a new api in Skaffolder project\n\n---- Generator ----\n")
  .option("-o, --online", "Work online on the Skaffolder project, requires sk login", null, false, false)
  .action(offlineCommandBuilder(createApiCmd))

  // generator
  .command("generator init", "Open a new generator")
  .action(createGeneratorCmd)
  .command("generator pull", "Load generator files from Skaffolder platform to local folder")
  .action(reloadGeneratorCmd)
  .command("generator push", "Save generator files from local folder to Skaffolder platform")
  .action(saveGeneratorCmd)
  .command("generator create", "Import generator files from current project folder")
  .action(importGeneratorCmd)
  .command("generator publish", "Share your local generator files with Skaffolder community\n\n---- Utils ----\n")
  .action(publishGeneratorCmd)

  // utils
  .command("web open", "Open web interface")
  .action(webOpenCmd)
  .command("set endpoint", "Set Skaffolder endpoint on-premise")
  .argument("[endpoint]", "", null, null)
  .action(setEndpointCmd)
  .command("get endpoint", "Get Skaffolder endpoint")
  .action(getEndpointCmd)
  .command("get user", "Get Skaffolder logged user")
  .action(getUserCmd)
  .command("get project url", "Get Skaffolder project URL")
  .action(getProjectUrlCmd)
  .command("list frontend", "List all the available frontend templates")
  .action(getTemplates("frontend"))
  .command("list backend", "List all the available backend templates")
  .action(getTemplates("backend"))
  .command("import db", "Import database entities from Schema Spy XML")
  .argument("<file>", "XML file to import", null, null)
  .action(importDbCmd)
  .command("export", "Export project to Skaffolder platform")
  .action(exportProjectCommand);

prog.parse(process.argv);
