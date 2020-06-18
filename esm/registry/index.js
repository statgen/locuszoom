import adapters from './data';
import data_layers from './data_layers';
import layouts from './layouts';
import plugins from './plugins';
import scalable from './scalable';
import transforms from './transforms';
import widgets from './widgets';


plugins.add('adapters', adapters);
plugins.add('widgets', widgets);
plugins.add('data_layers', data_layers);
plugins.add('layouts', layouts);
plugins.add('scalable', scalable);
plugins.add('transforms', transforms);


export { adapters, data_layers, layouts, plugins, scalable, transforms, widgets };
