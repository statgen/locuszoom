import adapters from './data';
import dashboards from './dashboards';
import data_layers from './data_layers';
import layouts from './layouts';
import plugins from './plugins';
import scalable from './scalable';
import transforms from './transforms';

plugins.add('adapters', adapters);
plugins.add('dashboards', dashboards);
plugins.add('data_layers', data_layers);
plugins.add('layouts', layouts);
plugins.add('scalable', scalable);
plugins.add('transforms', transforms);

export { adapters, dashboards, data_layers, layouts, plugins, scalable, transforms };
