var fs = require('fs');
var Handlebars = require('handlebars');
var chalk = require('chalk');
var helpers = require('handlebars-helpers')({
    handlebars: Handlebars
});
var groupBy = require('handlebars-group-by');

groupBy.register(Handlebars);

var mkdirp = require('mkdirp');
var extend = require('util')._extend;

var paramsGenerator = {};

// comment on templates
var comment = function (file, extension) {

    var text = "Generated by Skaffolder\nFor documentation visit http://skaffolder.com/#/documentation";

    var linkDoc = {
        js: {
            open: "// -------------\n// ",
            close: "\n// -------------\n\n"
        },
        ts: {
            open: "// -------------\n// ",
            close: "\n// -------------\n\n"
        },
        html: {
            open: "<!-- \n     ",
            close: "\n-->\n    \n"
        },
        java: {
            open: "// -------------\n// ",
            close: "\n// -------------\n\n"
        },
        php: {
            open: "<?php \n//",
            close: "\n?>\n\n"
        }
    };

    if (file.name.endsWith(extension)) {
        file.template = linkDoc[extension].open + text + linkDoc[extension].close + file.template;
    }

    return file.template;
};

exports.init = function (pathWorkspace2, project, modules, resources, dbs) {
    paramsGenerator = {
        project: project,
        modules: modules,
        resources: resources,
        dbs: dbs
    };

    pathWorkspace = pathWorkspace2;
};

var insertInto = function (html, partialTmpl, params, tagFrom, tagTo, log) {

    try {
        var insertAt = html.indexOf(tagFrom);

        if (insertAt != -1) {
            var untilAt = html.indexOf(tagTo);
            var template = Handlebars.compile(partialTmpl);
            var partialCode = template(params);
            html = html.slice(0, insertAt + tagFrom.length) + '\n' + partialCode + html.slice(untilAt - 1);
        }

        return html;
    } catch (e) {
        console.error(e);
        var err = {
            'Error': {
                "message": e.message
            }
        };
        log.push(err);
    }
};


exports.generateFile = function (log, file, paramLoop, opt) {

    var output = "";
    var path = require('path');

    // Bynary files
    if (file.templateBinary) {
        var template = Handlebars.compile(file.name);
        var fileNameDest = template(param);
        if (pathWorkspace) {
            var path = pathWorkspace + fileNameDest;
            mkdirp.sync(path.substr(0, path.lastIndexOf('/')));
            fs.writeFileSync(path, file.templateBinary, "binary");
            return;
        }
    }

    // Text files
    try {
        //SET PARAMS
        var param = paramsGenerator;
        for (var index in paramLoop) {
            param[index] = paramLoop[index];
        }

        param.extra = {};
        if (opt && opt.extra) {
            for (var i in opt.extra) {
                if (opt.extra[i])
                    param.extra[opt.extra[i].name] = opt.extra[i].value;
            }
        }

        //GET FILE NAME
        //console.info(chalk.gray("log: ") + file.name);
        var fileName = file.name.replace(/{{\\(([A-Za-z\s])*)}}/g, '{{/$1}}');
        fileName = fileName.replace(/\\/g, '\\\\');
        //console.info(chalk.gray("log: ") + fileName);
        var template = Handlebars.compile(fileName);
        var fileNameDest = template(param);
        //console.info(chalk.gray("log: ") + fileNameDest);

        if (pathWorkspace) {
            var pathFile = path.normalize(pathWorkspace + fileNameDest);

            if (file.ignore && fs.existsSync(pathFile)) {
                //console.info(chalk.gray("File ignored: ") + file.name);
                return;
            }

            // READ FILE OR TEMPLATE
            if (!file.overwrite && fs.existsSync(pathFile)) {
                output = fs.readFileSync(pathFile, 'utf8');
                //console.info(chalk.gray("File ignored: ") + pathFile);
            } else {
                var template = "";
                if (paramLoop && paramLoop.module && paramLoop.module.template) {
                    var templateSplit = paramLoop.module.template.split('_');
                    if (templateSplit[0] == "List") {
                        if (file.templateList) {
                            template = Handlebars.compile(file.templateList);
                        } else {
                            console.warn(chalk.yellow("Template List not found for page " + paramLoop.module.name));
                            console.log("Please add file " + file.name + "_SK_LIST.hbs")
                            template = Handlebars.compile(file.template);
                        }
                    }
                    if (templateSplit[0] == "Edit") {
                        if (file.templateEdit) {
                            template = Handlebars.compile(file.templateEdit);
                        } else {
                            console.warn(chalk.yellow("Template Edit not found for page " + paramLoop.module.name));
                            console.log("Please add file " + file.name + "_SK_EDIT.hbs")
                            template = Handlebars.compile(file.template);
                        }
                    }
                } else {
                    template = Handlebars.compile(file.template);
                }

                try {
                    output = template(param);
                } catch (e) {
                    console.log(chalk.red("File with error: ") + pathFile);
                    console.error(e);
                }
            }
        } else {
            //FOR TESTING PREVIEW
            opt.params.push(param);

            var template = "";
            if (paramLoop && paramLoop.module && paramLoop.module.template) {
                var templateSplit = paramLoop.module.template.split('_');
                if (templateSplit[0] == "List")
                    template = Handlebars.compile(file.templateList);
                if (templateSplit[0] == "Edit")
                    template = Handlebars.compile(file.templateEdit);
            } else {
                template = Handlebars.compile(file.template);
            }

            output = template(param);
        }


        //EXTRA ACTION
        for (var i in file._partials) {
            var partial = file._partials[i];
            output = insertInto(output, partial.template, param, partial.tagFrom, partial.tagTo, log);
        }

        //IF IS TEST PREVIEW
        if (opt && opt.test) {
            return output
        }

        //WRITE
        var folderFile = path.normalize(pathFile.substr(0, pathFile.lastIndexOf(path.normalize('/'))));
        var res = mkdirp.sync(folderFile);
        if (output != '') {

            if (fs.existsSync(pathFile)) {
                let actual = fs.readFileSync(pathFile, 'utf8');
                if (actual != output)
                    console.info(chalk.green("File modified: ") + pathFile);
            } else {
                console.info(chalk.green("File created: ") + pathFile);
            }

            fs.writeFileSync(pathFile, output);
        }
    } catch (e) {
        console.error(e);
        var err = {
            'Error': {
                "message": e.message
            }
        };
        log.push(err);
    }
};


//SET HANDLEBARS
Handlebars.registerHelper('joinObj', function (arr, field) {
    var result = [];
    for (i in arr) {
        result.push(arr[i][field]);
    }
    return JSON.stringify(result);
});

Handlebars.registerHelper('joinObj2', function (arr) {
    var result = "";
    for (i in arr) {
        result += (i != 0 ? ', "' : '"') + arr[i]['name'] + '"';
    }
    return new Handlebars.SafeString(result);
});

Handlebars.registerHelper('joinRoleObj', function (arr) {
    var result = "";
    for (i in arr) {
        result += ', "ROLE_' + arr[i]['name'] + '"';
    }
    return new Handlebars.SafeString(result);
});
Handlebars.registerHelper('roleObj', function (arr) {
    var result = '"' + arr[0]['name'] + '"';
    for (i in arr) {
        if (arr[0]['name'] === arr[i]['name'])
            continue;
        result += ', "' + arr[i]['name'] + '"';
    }
    return new Handlebars.SafeString(result);
});

Handlebars.registerHelper('joinRoleObj2', function (arr) {
    var result = "";
    for (let i = 0; i < arr.length; i++) {
        if (i == 0) {
            result += '"ROLE_' + arr[i]['name'] + '"';
        } else {
            result += ', "ROLE_' + arr[i]['name'] + '"';
        }
    }
    return new Handlebars.SafeString(result);
});
Handlebars.registerHelper('roleObj', function (arr) {
    var result = '"' + arr[0]['name'] + '"';
    for (i in arr) {
        if (arr[0]['name'] === arr[i]['name'])
            continue;
        result += ', "' + arr[i]['name'] + '"';
    }
    return new Handlebars.SafeString(result);
});

Handlebars.registerHelper('json', function (context) {
    return new Handlebars.SafeString(JSON.stringify(context, null, 2));
});

Handlebars.registerHelper('firstUpperCase', function (s, options) {
    return s && s[0].toUpperCase() + s.slice(1);
});
Handlebars.registerHelper('subStr', function (string, start, options) {
    return string.substr(start);
});
Handlebars.registerHelper('subStrCap', function (string, start, options) {
    return string.substr(start).charAt(0).toUpperCase() + string.substr(start).slice(1);
});
Handlebars.registerHelper('equal', function (left, right, options) {
    if (left) left = left.toString();
    if (right) right = right.toString();

    if (left == right) {
        if (options.fn)
            return options.fn(this);
        else
            return 1;
    }

    if (options.inverse)
        return options.inverse(this);
    else
        return 0;
});
Handlebars.registerHelper('isNotLast', function (array, index, options) {
    if (array.length == index + 1)
        return options.inverse(this);
    else
        return options.fn(this);
});
Handlebars.registerHelper('isNotLastUser', function (array, index, options) {
    if (array.length == index + 1)
        return options.inverse(this);
    else {
        if (array.length == index + 2) {
            arrayTmp = array.slice(index);
            if (arrayTmp.slice(-1)[0].name == "username")
                return options.inverse(this);
        } else
            return options.fn(this);

    }
});
Handlebars.registerHelper('isNotLastRelations', function (array, resource, index, options) {
    if (array.length == index + 1) {
        return options.inverse(this);
    } else {
        for (let i = index + 1; i < array.length; i++) {
            if (array[i]._ent1._id.toString() != resource._id.toString())
                return options.fn(this);
            return options.inverse(this);
        }
    }

    //else
    //return options.fn(this);
});
Handlebars.registerHelper('checkRelation', function (array, resource, options) {
    if (array.length == 0)
        return options.inverse(this);
    if (array)
        for (let item in array) {
            if (array[item]._ent1._id.toString() == resource._id.toString())
                return options.fn(this);
        }
});

Handlebars.registerHelper('checkExternalRelation', function (array, resource, options) {
    if (array.length == 0)
        return options.inverse(this);
    if (array)
        for (let item in array) {
            if (array[item]._ent1._id.toString() != resource._id.toString())
                return options.fn(this);
        }
});
Handlebars.registerHelper('notEqual', function (left, right, exact, options) {
    if (left) left = left.toString();
    if (right) right = right.toString();
    options = options || exact;
    exact = (exact === 'exact') ? true : false;
    var is_equal = exact ? (left === right) : (left == right);
    if (!is_equal) return options.fn(this);
    return options.inverse(this);
});
Handlebars.registerHelper('notHome', function (parameter, options) {
    if (parameter) parameter = parameter.toString().toLowerCase();
    if (parameter !== "home") return options.fn(this);
    return options.inverse(this);
});
Handlebars.registerHelper('notEqualArray', function (string, options) {

    var search = ['update', 'create', 'delete', 'list', 'get'];
    for (var id in search) {
        if (search[id] == string)
            return options.inverse(this);
    }
    return options.fn(this);
});
Handlebars.registerHelper('isInUrl', function (param, url, options) {

    var urlParams = url.match(/{\w+}/g);
    if (urlParams && urlParams.indexOf('{' + param + '}') != -1)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('relationName', function (resource, name, url, options) {

    relation = resource.find(x => x.type === "m:m");
    nameRelation = relation && relation.name === name.substr(3) && relation._ent2.name;
    return nameRelation;
});
Handlebars.registerHelper('relationNameService', function (resource, name, url, options) {
    relation = resource.find(x => x.name.toLowerCase() === name.substr(6).toLowerCase());
    nameRelation = relation && relation.name === name.substr(6) && relation._ent2.name;
    return nameRelation;
});
Handlebars.registerHelper('relationNameServiceLowercase', function (resource, name, url, options) {
    relation = resource.find(x => x.name.toLowerCase() === name.substr(6).toLowerCase());
    nameRelation = relation && relation.name === name.substr(6) && relation._ent2.name;
    return nameRelation.toLowerCase();
});
Handlebars.registerHelper('resolveSQLtype', function (value, options) {
    if (value == "Number")
        return "numeric";
    else if (value == "Date")
        return "date";
    else if (value == "Integer")
        return "int";
    else if (value == "Decimal")
        return "decimal(6,2)";
    else if (value == "String")
        return "varchar(40)";
    else if (value == "Boolean")
        return "bool";
    else if (value == "ObjectId")
        return "int(11)";

    return "varchar(30)";
});
Handlebars.registerHelper('isEmptyArray', function (value, options) {
    if (value && value.length == 0)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('notEmpty', function (value, options) {
    if (value && value.length != 0)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('isEmpty', function (value, options) {
    if (value && value.length != 0)
        return options.inverse(this);
    else
        return options.fn(this);
});
Handlebars.registerHelper('isEmptyNull', function (value, options) {
    if (value && value.length != 0)
        return options.inverse(this);
    else
        return options.fn(this);
});
Handlebars.registerHelper('notNull', function (value, options) {
    if (value != undefined)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('isNull', function (value, options) {
    if (value == null)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('startWith', function (src, search, options) {
    if (src && src.indexOf(search) == 0 && src != search) {
        if (options.fn)
            return options.fn(this);
        else
            return 1;
    } else {
        if (options.inverse)
            return options.inverse(this);
        else
            return 0;
    }
});
Handlebars.registerHelper('notStartWith', function (src, search, options) {
    if (src && src.indexOf(search) == 0 && src != search)
        return options.inverse(this);
    else
        return options.fn(this);
});
Handlebars.registerHelper('editUrlParam', function (url) {
    return url.replace(/{/g, ':').replace(/}/g, '').replace(/\/$/, '');
});

Handlebars.registerHelper('editUrlParamGo', function (url) {
    return url;
});

Handlebars.registerHelper('editUrlParamRegExp', function (url) {
    if (url == '/')
        url = '/*';

    return url.replace(/{[\s\S]*}/g, '([^/])+');
});

Handlebars.registerHelper('toGoType', function (type) {
    if (type == 'Integer') type = "int";
    if (type == 'Date') type = "int";
    if (type == 'Number') type = "float32";
    if (type == 'Decimal') type = "float32";
    if (type == 'String') type = "string";
    if (type == 'ObjectId') type = "int";
    return type;
});

Handlebars.registerHelper('toJSType', function (type) {
    if (type == 'Integer') type = "Number";
    if (type == 'Decimal') type = "Number";
    return type;
});

Handlebars.registerHelper('toTSType', function (type) {
    if (type == 'Integer') type = "number";
    if (type == 'Number') type = "number";
    if (type == 'Decimal') type = "number";
    if (type == 'String') type = "string";
    return type;
});

Handlebars.registerHelper('toJDBCType', function (type) {
    if (type == 'Integer') type = "Int";
    if (type == 'Decimal') type = "BigDecimal";
    if (type == 'Number') type = "BigDecimal";
    if (type == 'ObjectId') type = "Long";
    return type;
});


Handlebars.registerHelper('toJavaType', function (type) {
    if (type == 'Decimal') type = "BigDecimal";
    if (type == 'Number') type = "Double";
    if (type == 'ObjectId') type = "Long";
    return type;
});

Handlebars.registerHelper('toSwaggerType', function (type) {
    if (type == 'Integer') type = "integer";
    if (type == 'Decimal') type = "number";
    if (type == 'Number') type = "number";
    if (type == 'ObjectId') type = "string";
    if (type == 'String') type = "string";
    if (type == 'Date') type = "integer";
    if (type == 'Boolean') type = "boolean";
    if (type == 'ObjectId') type = "string";
    return type;
});

Handlebars.registerHelper('removeFinalSlash', function (url) {
    if (url[url.length] == "/")
        url.substr(0, url.length - 1);
    return url;
});

Handlebars.registerHelper('removeInitialSlash', function (url) {
    if (url[0] == "/")
        return url.substr(1, url.length).replace(/{/g, ':').replace(/}/g, '');
    return url;
});

Handlebars.registerHelper('isRequired', function (required, options) {
    if (!required) {
        return options.fn("?");
    }
});

Handlebars.registerHelper('toFileName', function (name) {
    name = name.replace(/([a-z])([A-Z])/g, "$1-$2");
    name = name.toLowerCase();
    return name;
});

Handlebars.registerHelper('isMtoM', function (RelationName, relations, resourceName, options) {
    var found = false;
    RelationName = RelationName.substr(6);
    for (var i in relations) {
        if (relations[i].name == RelationName && relations[i].type == "m:m" && relations[i]._ent1.name == resourceName)
            found = relations[i];
    }

    this.relations = found;
    if (found)
        return options.fn(this);
    else
        return options.inverse(this);
});

Handlebars.registerHelper('eachResource', function (services, options) {
    var resources = {};
    var buffer = "";

    for (var s in services) {
        if (!resources[services[s]._resource._id]) {
            resources[services[s]._resource._id] = true;
            buffer += options.fn(services[s]._resource);
        }
    }

    return buffer;
});

Handlebars.registerHelper('getDbName', function (dbs, idDb) {
    for (var i in dbs) {
        if (dbs[i]._id.toString() == idDb.toString())
            return dbs[i].name;
    }
});


Handlebars.registerHelper('getDbNameToFileName', function (dbs, idDb) {
    for (var i in dbs) {
        if (dbs[i]._id.toString() == idDb.toString()) {
            var name = dbs[i].name;
            name = name.replace(/([a-z])([A-Z])/g, "$1-$2");
            name = name.toLowerCase();
            return name;
        }
    }
});

Handlebars.registerHelper('buildUrlSecurity', function (url, options) {
    return url === "/{id}" ? "/**" : url;
});


Handlebars.registerHelper('unslug', function (msg) {
    return msg.replace(/_/g, " ");
});
Handlebars.registerHelper('oneElementArray', function (value, options) {
    if (value && value.length == 1)
        return options.fn(this);
    else
        return options.inverse(this);
});
Handlebars.registerHelper('firstElementArray', function (array, options) {
    return array[0]['name'];
});
Handlebars.registerHelper('urlSecurity', function (url, options) {
    if (url === '/')
        return '';
    if (url.indexOf('{id}') != -1)
        return url.replace('{id}', '**')
});
Handlebars.registerHelper('moreThanOneElement', function (array, options) {
    if (array.length > 1)
        return options.fn(this);
    else
        return options.inverse(this);
});


Handlebars.registerHelper('distinctRelations', function (array, entityName, options) {

    var present = [];
    var buffer = "";

    for (var i in array) {
        var item = array[i];

        if (item.type == '1:m' && item._ent1.name == entityName) {
            if (!present[item._ent2.name]) {
                present[item._ent2.name] = item;
                buffer += options.fn(item);
            }
        }
    }

    return buffer;
});
Handlebars.registerHelper('distinctModules', function (array, options) {

    var present = [];
    var buffer = "";

    for (var i in array) {
        var item = array[i];
        if (!present[item.name]) {
            present[item.name] = item;
            buffer += options.fn(item);
        }
    }
    return buffer;
});


Handlebars.registerHelper('distinctRelationsEditComponent', function (crudResource, options) {
    var present = [];
    var buffer = "";

    buffer += options.fn({
        resourceName: crudResource.name,
        dbName: crudResource._db
    });
    present[crudResource.name] = true;

    for (var i in crudResource._relations) {
        var item = crudResource._relations[i];

        if (item._ent1._id.toString() == crudResource._entity._id.toString()) {

            var resourceName = item._ent2.name;
            if (!present[resourceName]) {
                var result = {
                    resourceName: resourceName,
                    dbName: item._ent2._resource._db
                };
                present[resourceName] = result;
                buffer += options.fn(result);
            }

        } else {
            var resourceName = item._ent1.name;

            if (!present[resourceName]) {
                var result = {
                    resourceName: resourceName,
                    dbName: item._ent2._resource._db
                };
                present[resourceName] = result;
                buffer += options.fn(result);
            }
        }
    }

    return buffer;
});