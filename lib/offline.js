const offlineService = require("../utils/offlineService");

const offlineCommandBuilder = cmd => {
  return (args, options, logger) => {
    global.OFFLINE = !options.online;
    global.ONLINE = !global.OFFLINE;
    global.logger = logger;

    cmd(args, options, logger);
  };
};

const _commitYamlProject = yamlProject => offlineService.commitYaml(yamlProject, exports.pathWorkspace, global.logger);
const _getYamlProject = () => offlineService.getYaml(exports.pathWorkspace, global.logger);

const _sortKeys = obj => {
  let keys = Object.keys(obj).sort();

  return keys.reduce((acc, cur) => {
    acc[cur] = JSON.parse(JSON.stringify(obj[cur]));

    return acc;
  }, {});
};

const pluralize = str => {
  str = str.toLowerCase();
  if (str[str.length - 1] == "s") return str + "es";
  else return str + "s";
};

const _createService = (yamlProject, service, _res) => {
  let paths = yamlProject.paths;
  let _service = {};

  if (paths) {
    let url = service.url.startsWith("/") ? service.url : `/${service.url}`;
    let serviceFullName = _res.url + (url.endsWith("/") ? url.slice(0, -1) : url);

    if (!paths[serviceFullName]) {
      paths[serviceFullName] = {};
    }

    _service = {
      "x-skaffolder-id": offlineService.getDummyId(`${service.name || service.method}_${_res.name}`, "service"),
      "x-skaffolder-id-resource": service._resource._id || service._resource,
      "x-skaffolder-name": service.name,
      "x-skaffolder-crudAction": service.crudAction,
      "x-skaffolder-url": url,
      "x-skaffolder-description": service.description || `${service.name} ${service.method}`,
      "x-skaffolder-roles": service._roles,
      "x-skaffolder-returnType": service.returnType
    };

    let serviceYaml = paths[serviceFullName][service.method.toLowerCase()] || {};
    if (service._params && service._params.length > 0) {
      _service.parameters = service._params.map(param => {
        return {
          name: param.name,
          "x-skaffolder-type": param.type,
          description: param.description
        };
      });
    } else {
      delete serviceYaml.parameters;
    }

    paths[serviceFullName][service.method.toLowerCase()] = Object.assign(serviceYaml, _service);
  }

  return { _service: _service, yamlProject: yamlProject };
};

let _findServiceForResAndCrudAction = (yamlPaths, res_id, crudAction) => {
  if (yamlPaths) {
    for (path_name in yamlPaths) {
      let path = yamlPaths[path_name];

      for (method_name in path) {
        let service = path[method_name];

        if (service && service["x-skaffolder-id-resource"] == res_id && service["x-skaffolder-crudAction"] == crudAction) {
          return service;
        }
      }
    }
  }

  return null;
};

const _findPageForResAndTemplate = (yamlPages, res_id, template) => {
  if (yamlPages) {
    return yamlPages.find(page => {
      return page["x-skaffolder-template"] == template && page["x-skaffolder-resource"] == res_id;
    });
  }

  return null;
};

const _findPage = (yamlPages, page_id) => {
  if (yamlPages) {
    return yamlPages.find(page => {
      return page["x-skaffolder-id"] == page_id;
    });
  }

  return null;
};

let _findOrCreateDb = yamlProject => {
  let yamlComponents = yamlProject["components"];
  if (!yamlComponents["x-skaffolder-db"]) {
    yamlComponents["x-skaffolder-db"] = [];
  }

  if (yamlComponents["x-skaffolder-db"].length == 0) {
    let db_name = `${yamlProject["info"]["title"]}_db`;

    let newDb = {
      "x-skaffolder-id": offline.getDummyId(db_name, "db"),
      "x-skaffolder-name": db_name
    };

    yamlComponents["x-skaffolder-db"].push(newDb);
    yamlProject["components"] = yamlComponents;

    return newDb;
  }

  return yamlComponents["x-skaffolder-db"][0];
};

let _findModel = (yamlModels, model_query) => {
  if (yamlModels) {
    for (model_name in yamlModels) {
      let model = yamlModels[model_name];

      if (model["x-skaffolder-id"] == model_query || model_name == model_query) {
        return model;
      }
    }
  }

  return null;
};

let _findAndRemoveService = (yamlPaths, service_id) => {
  if (yamlPaths && service_id) {
    for (service_path in yamlPaths) {
      let service_full = yamlPaths[service_path];

      for (service_method in service_full) {
        let service = service_full[service_method];

        if (service["x-skaffolder-id"] == service_id) {
          let _service = offlineService.cloneObject(service);
          delete yamlPaths[service_path][service_method];

          if (Object.keys(yamlPaths[service_path]).length == 0) {
            delete yamlPaths[service_path];
          }

          return _service;
        }
      }
    }
  }

  return null;
};

let _findAllServicesByResourceId = (yamlPaths, res_id) => {
  let services_ids = [];

  if (yamlPaths && res_id) {
    for (service_path in yamlPaths) {
      let service_full = yamlPaths[service_path];

      for (service_method in service_full) {
        let service = service_full[service_method];

        if (service["x-skaffolder-id"] && service["x-skaffolder-id-resource"] == res_id) {
          services_ids.push(service["x-skaffolder-id"]);
        }
      }
    }
  }

  return services_ids;
};

let _findModelByEntIdOrName = (yamlComponents, model_query) => {
  let schemas = yamlComponents.schemas;

  if (schemas) {
    for (model_name in schemas) {
      let model = schemas[model_name];

      if (model["x-skaffolder-id-entity"] == model_query || `${model_name}`.toLowerCase() == `${model_query}`.toLowerCase()) {
        let modelObj = JSON.parse(JSON.stringify(model));
        modelObj["x-skaffolder-name"] = model_name;

        return modelObj;
      }
    }
  }

  return null;
};

let createCrud = model => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return {};
  }

  let _model = _findModelByEntIdOrName(yamlProject.components, model["x-skaffolder-id-entity"]);
  if (!_model) {
    return;
  }

  let model_name = _model["x-skaffolder-name"];

  let crud_services = [
    {
      name: "get",
      url: "/{id}",
      method: "GET",
      _params: [
        {
          name: "id",
          type: "ObjectId",
          description: "Id " + model_name
        }
      ]
    },
    {
      name: "list",
      url: "/",
      method: "GET",
      returnType: "ARRAY OF " + model_name
    },
    {
      name: "update",
      url: "/{id}",
      method: "POST",
      _params: [
        {
          name: "id",
          type: "ObjectId",
          description: "Id " + model_name
        }
      ]
    },
    {
      name: "delete",
      url: "/{id}",
      method: "DELETE",
      _params: [
        {
          name: "id",
          type: "ObjectId",
          description: "Id " + model_name
        }
      ]
    },
    {
      name: "create",
      url: "/",
      method: "POST"
    }
  ];

  let services_ids = {
    edit: [],
    list: []
  };

  let _relations = model["x-skaffolder-relations"];
  let _service = {};
  if (_relations) {
    for (id in _relations) {
      let _rel = _relations[id];
      let _rel_name = _rel["x-skaffolder-name"];

      if (_rel["x-skaffolder-ent1"] == model["x-skaffolder-id-entity"]) {
        let rel_model2 = _findModelByEntIdOrName(yamlProject.components, _rel["x-skaffolder-ent2"]);
        if (rel_model2) {
          _service = _findServiceForResAndCrudAction(yamlProject.paths, rel_model2["x-skaffolder-id"], "list");
          if (!_service) {
            _service = {
              _resource: rel_model2["x-skaffolder-id"],
              name: "list",
              url: "/",
              method: "GET",
              returnType: `ARRAY OF ${rel_model2["x-skaffolder-name"]}`,
              crudAction: "list",
              description: "CRUD ACTION LIST",
              _params: [],
              returnType: "",
              _roles: []
            };

            let obj = _createService(yamlProject, _service, {
              name: rel_model2["x-skaffolder-name"],
              url: rel_model2["x-skaffolder-url"]
            });
            yamlProject = obj.yamlProject;
            _service = obj._service;
          }
        }

        services_ids.edit.push(_service["x-skaffolder-id"]);
      } else if (_rel["x-skaffolder-ent2"] == model["x-skaffolder-id-entity"]) {
        let rel_model1 = _findModelByEntIdOrName(yamlProject.components, _rel["x-skaffolder-ent1"]);

        if (rel_model1) {
          let service_name = `findBy${_rel_name}`;
          _service = _findServiceForResAndCrudAction(yamlProject.paths, rel_model1["x-skaffolder-id"], service_name);

          if (!_service) {
            _service = {
              _resource: rel_model1["x-skaffolder-id"],
              name: service_name,
              url: `/${service_name}/{key}`,
              method: "GET",
              description: `CRUD ACTION ${service_name}`,
              returnType: "",
              _roles: [],
              crudAction: service_name,
              _params: [
                {
                  name: "key",
                  type: "ObjectId",
                  description: `Id of model to search for`
                }
              ]
            };

            let obj = _createService(yamlProject, _service, {
              name: rel_model1["x-skaffolder-name"],
              url: rel_model1["x-skaffolder-url"]
            });
            yamlProject = obj.yamlProject;
            _service = obj._service;
          }

          services_ids.edit.push(_service["x-skaffolder-id"]);
        }
      }
    }
  }

  // return;
  crud_services.forEach(service => {
    let _service = _findServiceForResAndCrudAction(yamlProject.paths, model["x-skaffolder-id"], service.name);

    if (!_service) {
      _service = service;
      _service.crudAction = service.name;
      _service.description = `CRUD ACTION ${service.crudAction}`;
      _service._roles = [];

      if (!service._params) {
        _service._params = [];
      }

      if (!service.returnType) {
        _service.returnType = "";
      }

      if (!service._resource) {
        _service._resource = model["x-skaffolder-id"];
      }

      let obj = _createService(yamlProject, _service, { name: model_name, url: _model["x-skaffolder-url"] });
      yamlProject = obj.yamlProject;
      _service = obj._service;
    }

    switch (_service["x-skaffolder-crudAction"]) {
      case "create":
      case "update":
      case "get":
        services_ids.edit.push(_service["x-skaffolder-id"]);
        break;
      case "delete":
      case "list":
        services_ids.list.push(_service["x-skaffolder-id"]);
        break;
      default:
        break;
    }
  });

  const components = yamlProject.components;
  const page_types = ["Edit", "List"];
  let page_edit_id;
  let page_list_id;

  page_types.forEach(page_type => {
    let oldPage = _findPageForResAndTemplate(components["x-skaffolder-page"], model["x-skaffolder-id"], `${page_type}_Crud`);

    if (!oldPage) {
      let page_name = `${model_name}${page_type}`;
      let newPage = {
        "x-skaffolder-id": offlineService.getDummyId(page_name, "page"),
        "x-skaffolder-url": `/${pluralize(model_name)}${page_type == "Edit" ? "/{id}" : ""}`.toLowerCase(),
        "x-skaffolder-name": page_name,
        "x-skaffolder-template": `${page_type}_Crud`,
        "x-skaffolder-resource": model["x-skaffolder-id"],
        "x-skaffolder-roles": []
      };

      newPage["x-skaffolder-services"] = [...services_ids[page_type.toLowerCase()]];

      if (page_type == "Edit") {
        page_edit_id = newPage["x-skaffolder-id"];
      } else {
        newPage["x-skaffolder-links"] = [page_edit_id];
        page_list_id = newPage["x-skaffolder-id"];
      }

      if (components) {
        if (!components["x-skaffolder-page"]) {
          components["x-skaffolder-page"] = [];
        }

        components["x-skaffolder-page"].push(newPage);
      }
    } else {
      let services = oldPage["x-skaffolder-services"] || [];

      services_ids[page_type.toLowerCase()].forEach(_service => {
        if (services.indexOf(_service) == -1) {
          services.push(_service);
        }
      });

      oldPage["x-skaffolder-services"] = [...services];

      if (page_type == "Edit") {
        page_edit_id = oldPage["x-skaffolder-id"];
      } else {
        if (!oldPage["x-skaffolder-links"]) {
          oldPage["x-skaffolder-links"] = [page_edit_id];
        } else if (oldPage["x-skaffolder-links"].indexOf(page_edit_id) == -1) {
          oldPage["x-skaffolder-links"].push(page_edit_id);
        }

        page_list_id = oldPage["x-skaffolder-id"];
      }

      if (components && components["x-skaffolder-page"]) {
        let index = components["x-skaffolder-page"].reduce((acc, val, i) => {
          if (val["x-skaffolder-id"] == oldPage["x-skaffolder-id"]) {
            return i;
          }
          return acc;
        }, -1);

        if (index != -1) {
          components["x-skaffolder-page"].splice(index, 1, oldPage);
        }
      }
    }
  });

  if (components && components["x-skaffolder-page"]) {
    let homePage = components["x-skaffolder-page"].find(page => {
      return page["x-skaffolder-name"] && page["x-skaffolder-name"].toLowerCase() == "home";
    });

    if (homePage) {
      if (!homePage["x-skaffolder-links"]) {
        homePage["x-skaffolder-links"] = [page_list_id];
      } else if (homePage["x-skaffolder-links"].indexOf(page_list_id) == -1) {
        homePage["x-skaffolder-links"].push(page_list_id);
      }

      let index = components["x-skaffolder-page"].reduce((acc, val, i) => {
        if (val["x-skaffolder-id"] == homePage["x-skaffolder-id"]) {
          return i;
        }
        return acc;
      }, -1);

      if (index != -1) {
        components["x-skaffolder-page"].splice(index, 1, homePage);
      }
    }
  }

  // commit project to openApi.yaml file
  _commitYamlProject(yamlProject, global.logger);
};

const createApi = (service, _res) => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return {};
  }

  if (!_res) {
    let skProject = offlineService.translateYamlProject(yamlProject);

    if (skProject.resources) {
      skProject.resources.forEach(db => {
        _res = db._resources.find(item => {
          return item._id == service._resource;
        });
      });

      if (!_res) {
        return;
      }
    }
  }

  let obj = _createService(yamlProject, service, _res);
  let _service = obj._service;
  yamlProject = obj.yamlProject;

  // commit project to openApi.yaml file
  _commitYamlProject(yamlProject, global.logger);

  return _service;
};

const createApiYAml = (service_yaml, service_method, _res) => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return {};
  }

  let yamlPaths = yamlProject.paths;
  if (yamlPaths) {
    let service = offlineService.cloneObject(_findAndRemoveService(yamlPaths, service_yaml["x-skaffolder-id"]));
    let url = `${service_yaml["x-skaffolder-url"]}`.startsWith("/")
      ? service_yaml["x-skaffolder-url"]
      : `/${service_yaml["x-skaffolder-url"]}`;
    let complete_url = `${_res.url}${url}`;
    service_method = `${service_method}`.toLowerCase();

    if (!service) {
      service = {
        "x-skaffolder-id": offlineService.getDummyId(
          `${service_yaml["x-skaffolder-name"] || service_method}_${_res.name}`,
          "service"
        )
      };

      if (!yamlPaths[complete_url]) {
        yamlPaths[complete_url] = {};
      }
    }

    Object.assign(service, service_yaml);

    if (service_yaml.parameters) {
      service.parameters = service_yaml.parameters.map(val => {
        val.schema = {};

        switch (val["x-skaffolder-type"]) {
          case "Date":
          case "Integer":
            val.schema.type = "integer";
            break;
          case "Decimal":
          case "Number":
            val.schema.type = "number";
            break;
          case "ObjectId":
          case "String":
            val.schema.type = "string";
            break;
          case "Boolean":
            val.schema.type = "boolean";
            break;
          case "Custom":
            val.schema.type = "object";
            break;
          default:
            val.schema.type = val["x-skaffolder-type"];
        }

        return val;
      });
    }

    if (!yamlPaths[complete_url]) {
      yamlPaths[complete_url] = {};
    }

    // save service
    yamlPaths[complete_url][service_method] = service;

    // commit project to openApi.yaml file
    _commitYamlProject(yamlProject, global.logger);

    return service;
  }

  return null;
};

const createModelSkaffolder = (model_name, db_id, attributes, relations, url) => {
  let yamlProject = _getYamlProject();
  let model = {};

  if (typeof yamlProject == "undefined") {
    return model;
  }

  let model_id_entity = offlineService.getDummyId(model_name, "entity");
  let model_id_resource = offlineService.getDummyId(model_name, "resource");

  let _properties;
  if (attributes) {
    _properties = attributes.reduce((acc, cur) => {
      let attr_type = cur.type || "String";

      acc[cur.name] = {
        type: attr_type.toLowerCase(),
        "x-skaffolder-type": attr_type
      };

      return acc;
    }, {});
  }

  let _relations;
  if (relations) {
    _relations = relations.reduce((acc, cur) => {
      acc[cur.name] = {
        "x-skaffolder-id": offlineService.getDummyId(`${model_name}_${cur.name}`, "relation"),
        "x-skaffolder-ent1": model_id_entity,
        "x-skaffolder-ent2": cur._ent2,
        "x-skaffolder-type": cur.type
      };

      return acc;
    }, {});
  }

  model = {
    "x-skaffolder-id": model_id_resource,
    "x-skaffolder-id-db": db_id,
    "x-skaffolder-id-entity": model_id_entity,
    "x-skaffolder-url": url,
    properties: _properties,
    "x-skaffolder-relations": _relations,
    required: ["_id"]
  };

  if (yamlProject.components && yamlProject.components.schemas) {
    yamlProject.components.schemas[model_name] = model;
  }

  // commit project to openApi.yaml file
  _commitYamlProject(yamlProject, global.logger);

  return model;
};

const createModelYaml = (model_name, model_yaml) => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return {};
  }

  if (yamlProject.components) {
    let yamlSchemas = yamlProject.components.schemas || {};

    let model = offlineService.cloneObject(_findModel(yamlSchemas, model_yaml["x-skaffolder-id"] || model_name));

    if (!model) {
      model = {
        "x-skaffolder-id": offlineService.getDummyId(model_name, "resource"),
        "x-skaffolder-id-db": _findOrCreateDb(yamlProject)["x-skaffolder-id"],
        "x-skaffolder-id-entity": offlineService.getDummyId(model_name, "entity"),
        "x-skaffolder-url": `/${model_name.toLowerCase()}`
      };

      yamlSchemas[model_name] = model;
    }

    // assign old properties
    Object.assign(model, model_yaml);

    let _required = [];
    if (model_yaml["x-skaffolder-relations"]) {
      let _relations = {};

      for (rel_name in model_yaml["x-skaffolder-relations"]) {
        let rel = model_yaml["x-skaffolder-relations"][rel_name];

        if (!rel["x-skaffolder-id"]) {
          rel["x-skaffolder-id"] = offlineService.getDummyId(`${model_name}_${rel_name}`, "relation");
        }

        if (!rel["x-skaffolder-ent1"]) {
          rel["x-skaffolder-ent1"] = model["x-skaffolder-id-entity"];
        }

        let _ent2 = _findModelByEntIdOrName(yamlProject.components, rel["x-skaffolder-ent2"]);

        if (_ent2 && _ent2["x-skaffolder-id-entity"]) {
          rel["x-skaffolder-ent2"] = _ent2["x-skaffolder-id-entity"];

          _relations[rel_name] = Object.assign(
            {
              "x-skaffolder-id": null,
              "x-skaffolder-type": null,
              "x-skaffolder-ent1": null,
              "x-skaffolder-ent2": null
            },
            rel
          );
        }
      }

      model["x-skaffolder-relations"] = _sortKeys(_relations);
    }

    if (!model_yaml["properties"]) {
      model_yaml["properties"] = {};
    }

    if (!model_yaml["properties"]._id) {
      model_yaml["properties"]._id = {
        type: "string",
        "x-skaffolder-required": true
      };
    }

    for (attr_name in model_yaml["properties"]) {
      if (model_yaml["properties"][attr_name]["x-skaffolder-required"]) {
        _required.push(attr_name);
      }
    }

    model["properties"] = _sortKeys(model_yaml["properties"]);
    delete model["required"];

    model.required = _required.sort();

    // delete old model
    for (old_model_name in yamlSchemas) {
      if (yamlSchemas[old_model_name]["x-skaffolder-id"] == model["x-skaffolder-id"]) {
        delete yamlSchemas[old_model_name];
        break;
      }
    }

    // save new model
    yamlSchemas[model_name] = model;

    // sort keys
    yamlProject.components.schemas = _sortKeys(yamlSchemas);

    // commit project to openApi.yaml file
    _commitYamlProject(yamlProject, global.logger);

    return model;
  }

  return null;
};

const createPage = page_yaml => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return {};
  }

  if (yamlProject.components) {
    let yamlPages = yamlProject.components["x-skaffolder-page"] || [];

    let page = _findPage(yamlPages, page_yaml["x-skaffolder-id"]);
    let page_name = page_yaml["x-skaffolder-name"];

    if (!page) {
      page = {
        "x-skaffolder-id": offlineService.getDummyId(page_name, "page"),
        "x-skaffolder-url": `/${page_name}`.toLowerCase()
      };
      yamlPages.push(page);
    }

    // assign new properties (if any)
    page = Object.assign(page, page_yaml);

    yamlProject.components["x-skaffolder-page"] = yamlPages;
  }

  // commit project to openApi.yaml file
  _commitYamlProject(yamlProject, global.logger);

  return page;
};

const removePage = page_id => {
  return _removePage(_getYamlProject(), page_id);
};

const _removePage = (yamlProject, page_id) => {
  if (typeof yamlProject == "undefined") {
    return false;
  }

  if (yamlProject.components) {
    let oldYamlPages = yamlProject.components["x-skaffolder-page"] || [];
    let page_types = ["x-skaffolder-links", "x-skaffolder-nesteds"];

    if (oldYamlPages) {
      let newYamlPages = [...oldYamlPages];

      oldYamlPages.forEach((page, page_index) => {
        if (page["x-skaffolder-id"] == page_id) {
          newYamlPages.splice(page_index, 1);
        }
      });

      if (newYamlPages.length == oldYamlPages.length - 1) {
        newYamlPages.forEach(page => {
          page_types.forEach(page_type => {
            if (page[page_type]) {
              let index = page[page_type].indexOf(page_id);

              if (index != -1) {
                page[page_type].splice(index, 1);

                if (page[page_type].length == 0) {
                  page[page_type] = null;
                }
              }
            }
          });
        });

        yamlProject.components["x-skaffolder-page"] = newYamlPages;

        // commit project to openApi.yaml file
        _commitYamlProject(yamlProject, global.logger);

        return true;
      }
    }
  }

  return false;
};

const removeService = service_id => {
  return _removeService(_getYamlProject(), service_id);
};

const _removeService = (yamlProject, service_id) => {
  if (typeof yamlProject == "undefined") {
    return false;
  }

  if (yamlProject.paths) {
    let _service = _findAndRemoveService(yamlProject.paths, service_id);

    if (_service) {
      if (yamlProject.components && yamlProject.components["x-skaffolder-page"]) {
        yamlProject.components["x-skaffolder-page"].forEach(page_yaml => {
          let _services = page_yaml["x-skaffolder-services"];

          if (_services) {
            let index = _services.indexOf(service_id);

            if (index != -1) {
              _services.splice(index, 1);

              if (_services.length == 0) {
                page_yaml["x-skaffolder-services"] = null;
              }
            }
          }
        });
      }

      // commit project to openApi.yaml file
      _commitYamlProject(yamlProject, global.logger);

      return true;
    }
  }

  return false;
};

const removeModel = (resource_id, remove_pages) => {
  let yamlProject = _getYamlProject();

  if (typeof yamlProject == "undefined") {
    return false;
  }
  let yamlComponents = yamlProject.components;

  if (yamlComponents) {
    let yamlSchemas = yamlComponents.schemas;

    if (yamlSchemas) {
      let _model;

      for (model_name in yamlSchemas) {
        _model = yamlSchemas[model_name];

        if (_model["x-skaffolder-id"] == resource_id) {
          _model = offlineService.cloneObject(_model);
          delete yamlSchemas[model_name];
          break;
        }
      }

      if (_model) {
        let services_ids = _findAllServicesByResourceId(yamlProject.paths, resource_id);

        // remove services
        services_ids.forEach(_serv_id => _removeService(yamlProject, _serv_id));

        // remove template pages
        let yamlPages = yamlComponents["x-skaffolder-page"];
        if (yamlPages) {
          yamlPages.forEach(_page => {
            if (_page["x-skaffolder-resource"] && _page["x-skaffolder-resource"] == resource_id) {
              if (remove_pages) {
                _removePage(yamlProject, _page["x-skaffolder-id"]);
              } else {
                _page["x-skaffolder-resource"] = null;
                _page["x-skaffolder-template"] = null;
              }
            }
          });
        }

        // commit project to openApi.yaml file
        _commitYamlProject(yamlProject, global.logger);

        return true;
      }
    }
  }

  return false;
};

module.exports.offlineCommandBuilder = offlineCommandBuilder;

module.exports.createApi = createApi;
module.exports.createService = createApiYAml;
module.exports.createCrud = createCrud;
module.exports.createModelSkaffolder = createModelSkaffolder;
module.exports.createModel = createModelYaml;
module.exports.createPage = createPage;

module.exports.removePage = removePage;
module.exports.removeService = removeService;
module.exports.removeModel = removeModel;
