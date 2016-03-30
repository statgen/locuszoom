/* global LocusZoom*/

LocusZoom = LocusZoom || {};
LocusZoom.Stats = (function() {
    //Javascript port of R math library functions

    //CONSTANTS -------

    var DBL_EPSILON = 2.2204460492503130808472633361816e-16;
    var DBL_MIN = 2.2250738585072014e-308;
    var DBL_MAX_EXP = 1020; //this is a guess
    var DBL_MAX = Number.MAX_VALUE;
    var SCALE_FACTOR = 1.157920892373162e+77;
    var EULERS_CONST = 0.5772156649015328606065120900824024;
    var TOL_LOGCF = 1e-14;
    var LGAMMA_C = 0.2273736845824652515226821577978691e-12;

    var DXREL =  1.490116119384765625e-8;

    var M_LN2 = Math.LN2; //0.693147180559945309417232121458;
    var M_PI = Math.PI;
    var M_2PI = 2*M_PI;
    var M_LN_SQRT_2PI = Math.log(Math.sqrt(M_2PI));
    var M_SQRT_32 = 5.656854249492380195206754896838;
    var M_1_SQRT_2PI = 0.398942280401432677939946059934;
    var M_CUTOFF = M_LN2 * DBL_MAX_EXP / DBL_EPSILON;

    var S0 = 0.083333333333333333333;       /* 1/12 */
    var S1 = 0.00277777777777777777778;     /* 1/360 */
    var S2 = 0.00079365079365079365079365;  /* 1/1260 */
    var S3 = 0.000595238095238095238095238; /* 1/1680 */
    var S4 = 0.0008417508417508417508417508;/* 1/1188 */

    var SFERR_HALVES = [
        0.0, /* n=0 - wrong, place holder only */
        0.1534264097200273452913848,  /* 0.5 */
        0.0810614667953272582196702,  /* 1.0 */
        0.0548141210519176538961390,  /* 1.5 */
        0.0413406959554092940938221,  /* 2.0 */
        0.03316287351993628748511048, /* 2.5 */
        0.02767792568499833914878929, /* 3.0 */
        0.02374616365629749597132920, /* 3.5 */
        0.02079067210376509311152277, /* 4.0 */
        0.01848845053267318523077934, /* 4.5 */
        0.01664469118982119216319487, /* 5.0 */
        0.01513497322191737887351255, /* 5.5 */
        0.01387612882307074799874573, /* 6.0 */
        0.01281046524292022692424986, /* 6.5 */
        0.01189670994589177009505572, /* 7.0 */
        0.01110455975820691732662991, /* 7.5 */
        0.010411265261972096497478567, /* 8.0 */
        0.009799416126158803298389475, /* 8.5 */
        0.009255462182712732917728637, /* 9.0 */
        0.008768700134139385462952823, /* 9.5 */
        0.008330563433362871256469318, /* 10.0 */
        0.007934114564314020547248100, /* 10.5 */
        0.007573675487951840794972024, /* 11.0 */
        0.007244554301320383179543912, /* 11.5 */
        0.006942840107209529865664152, /* 12.0 */
        0.006665247032707682442354394, /* 12.5 */
        0.006408994188004207068439631, /* 13.0 */
        0.006171712263039457647532867, /* 13.5 */
        0.005951370112758847735624416, /* 14.0 */
        0.005746216513010115682023589, /* 14.5 */
        0.005554733551962801371038690  /* 15.0 */
    ];

    var LGAMMA_COEFS =  [0.3224670334241132182362075833230126e-0,
        0.6735230105319809513324605383715000e-1,/* = (zeta(3)-1)/3 */
        0.2058080842778454787900092413529198e-1,
        0.7385551028673985266273097291406834e-2,
        0.2890510330741523285752988298486755e-2,
        0.1192753911703260977113935692828109e-2,
        0.5096695247430424223356548135815582e-3,
        0.2231547584535793797614188036013401e-3,
        0.9945751278180853371459589003190170e-4,
        0.4492623673813314170020750240635786e-4,
        0.2050721277567069155316650397830591e-4,
        0.9439488275268395903987425104415055e-5,
        0.4374866789907487804181793223952411e-5,
        0.2039215753801366236781900709670839e-5,
        0.9551412130407419832857179772951265e-6,
        0.4492469198764566043294290331193655e-6,
        0.2120718480555466586923135901077628e-6,
        0.1004322482396809960872083050053344e-6,
        0.4769810169363980565760193417246730e-7,
        0.2271109460894316491031998116062124e-7,
        0.1083865921489695409107491757968159e-7,
        0.5183475041970046655121248647057669e-8,
        0.2483674543802478317185008663991718e-8,
        0.1192140140586091207442548202774640e-8,
        0.5731367241678862013330194857961011e-9,
        0.2759522885124233145178149692816341e-9,
        0.1330476437424448948149715720858008e-9,
        0.6422964563838100022082448087644648e-10,
        0.3104424774732227276239215783404066e-10,
        0.1502138408075414217093301048780668e-10,
        0.7275974480239079662504549924814047e-11,
        0.3527742476575915083615072228655483e-11,
        0.1711991790559617908601084114443031e-11,
        0.8315385841420284819798357793954418e-12,
        0.4042200525289440065536008957032895e-12,
        0.1966475631096616490411045679010286e-12,
        0.9573630387838555763782200936508615e-13,
        0.4664076026428374224576492565974577e-13,
        0.2273736960065972320633279596737272e-13,
        0.1109139947083452201658320007192334e-13/* = (zeta(40+1)-1)/(40+1) */
    ]; 
    var POIS_COEFS_A = [
        -1e99, /* placeholder used for 1-indexing */
        2/3.,
        -4/135.,
        8/2835.,
        16/8505.,
        -8992/12629925.,
        -334144/492567075.,
        698752/1477701225.
    ];
    var POIS_COEFS_B = [
        -1e99, /* placeholder */
        1/12.,
        1/288.,
        -139/51840.,
        -571/2488320.,
        163879/209018880.,
        5246819/75246796800.,
        -534703531/902961561600.
    ];
    var GAMCS = [
        +.8571195590989331421920062399942e-2,
        +.4415381324841006757191315771652e-2,
        +.5685043681599363378632664588789e-1,
        -.4219835396418560501012500186624e-2,
        +.1326808181212460220584006796352e-2,
        -.1893024529798880432523947023886e-3,
        +.3606925327441245256578082217225e-4,
        -.6056761904460864218485548290365e-5,
        +.1055829546302283344731823509093e-5,
        -.1811967365542384048291855891166e-6,
        +.3117724964715322277790254593169e-7,
        -.5354219639019687140874081024347e-8,
        +.9193275519859588946887786825940e-9,
        -.1577941280288339761767423273953e-9,
        +.2707980622934954543266540433089e-10,
        -.4646818653825730144081661058933e-11,
        +.7973350192007419656460767175359e-12,
        -.1368078209830916025799499172309e-12,
        +.2347319486563800657233471771688e-13,
        -.4027432614949066932766570534699e-14,
        +.6910051747372100912138336975257e-15,
        -.1185584500221992907052387126192e-15,
        +.2034148542496373955201026051932e-16,
        -.3490054341717405849274012949108e-17,
        +.5987993856485305567135051066026e-18,
        -.1027378057872228074490069778431e-18,
        +.1762702816060529824942759660748e-19,
        -.3024320653735306260958772112042e-20,
        +.5188914660218397839717833550506e-21,
        -.8902770842456576692449251601066e-22,
        +.1527474068493342602274596891306e-22,
        -.2620731256187362900257328332799e-23,
        +.4496464047830538670331046570666e-24,
        -.7714712731336877911703901525333e-25,
        +.1323635453126044036486572714666e-25,
        -.2270999412942928816702313813333e-26,
        +.3896418998003991449320816639999e-27,
        -.6685198115125953327792127999999e-28,
        +.1146998663140024384347613866666e-28,
        -.1967938586345134677295103999999e-29,
        +.3376448816585338090334890666666e-30,
        -.5793070335782135784625493333333e-31
    ];

    var ALGMCS = [
        +.1666389480451863247205729650822e+0,
        -.1384948176067563840732986059135e-4,
        +.9810825646924729426157171547487e-8,
        -.1809129475572494194263306266719e-10,
        +.6221098041892605227126015543416e-13,
        -.3399615005417721944303330599666e-15,
        +.2683181998482698748957538846666e-17,
        -.2868042435334643284144622399999e-19,
        +.3962837061046434803679306666666e-21,
        -.6831888753985766870111999999999e-23,
        +.1429227355942498147573333333333e-24,
        -.3547598158101070547199999999999e-26,
        +.1025680058010470912000000000000e-27,
        -.3401102254316748799999999999999e-29,
        +.1276642195630062933333333333333e-30
    ];

    var PNORM_A = [
        2.2352520354606839287,
        161.02823106855587881,
        1067.6894854603709582,
        18154.981253343561249,
        0.065682337918207449113
    ];
    var PNORM_B = [
        47.20258190468824187,
        976.09855173777669322,
        10260.932208618978205,
        45507.789335026729956
    ];
    var PNORM_C = [
        0.39894151208813466764,
        8.8831497943883759412,
        93.506656132177855979,
        597.27027639480026226,
        2494.5375852903726711,
        6848.1904505362823326,
        11602.651437647350124,
        9842.7148383839780218,
        1.0765576773720192317e-8
    ];
    var PNORM_D = [
        22.266688044328115691,
        235.38790178262499861,
        1519.377599407554805,
        6485.558298266760755,
        18615.571640885098091,
        34900.952721145977266,
        38912.003286093271411,
        19685.429676859990727
    ];
    var PNORM_P = [
        0.21589853405795699,
        0.1274011611602473639,
        0.022235277870649807,
        0.001421619193227893466,
        2.9112874951168792e-5,
        0.02307344176494017303
    ];
    var PNORM_Q = [
        1.28426009614491121,
        0.468238212480865118,
        0.0659881378689285515,
        0.00378239633202758244,
        7.29751555083966205e-5
    ];

    function R_Log1_Exp(x) {
        return ((x) > -M_LN2 ? Math.log(-Math.expm1(x)) : Math.log1p(-Math.exp(x)));
    }

    function R_D_exp(x, log_p) {
        return log_p ? x : Math.exp(x);
    }

    function R_D_fexp(f, x, give_log) {
        return give_log ? -0.5 * Math.log(f) + x : Math.exp(x)/Math.sqrt(f);
    }

    function sinpi(x) {
        if (isNaN(x)) {
            return x;
        }
        if (!Number.isFinite(x)) {
            return NaN;
        }
        x = x % 2;
        if (x <= -1) {
            x += 2.0;
        } else if (x > 1.0) {
            x -= 2.0;
        }
        if (x == 0.0 || x == 1.0) {
            return 0.0;
        }
        if (x==0.5) { 
            return 1.0;
        }
        if (x==-0.5) {
            return -1.0;
        }
        return Math.sin(M_PI * x);
    }

    function chebyshev_eval(x, a, n) {
        var b0, b1, b2, twox, i;

        if (n < 1 || n > 1000) {
            return NaN;
        }
        if (x < -1.1 || x > 1.1) {
            return NaN;
        }
        twox = x * 2;
        b2 = b1 = 0;
        b0 = 0;
        for (i = 1; i <= n; i++) {
            b2 = b1;
            b1 = b0;
            b0 = twox * b1 - b2 + a[n-i];
        }
        return (b0 - b2) * 0.5;
    }

    function lgammacor(x) {
        var tmp;
        var nalgm = 5;
        var xbig = 94906265.62425156;
        var xmax = 3.745194030963158e306;

        if (x < 10) {
            return NaN;
        } else if (x > xmax) {
            throw ("lgammacor underflow");
        } else if (x < xbig) {
            tmp = 10 / x;
            return chebyshev_eval(tmp * tmp * 2 - 1, ALGMCS, nalgm) / x;
        }
        return 1 / (x * 12);
    }

    function gammafn(x) {
        var i, n, y, sinpiy, value;

        var ngam = 22;
        var xmin = -170.5674972726612;
        var xmax = 171.61447887182298;
        var xsml = 2.2474362225598545e-308;

        if (isNaN(x)) {
            return(x);
        }

        if (x==0 || (x < 0 && x == Math.round(x))) {
            return NaN;
        }

        y = Math.abs(x);
        if (y <= 10) {
            n = parseInt(x, 10);
            if (x < 0) {
                n--;
            }
            y = x - n;
            n--;
            value = chebyshev_eval(y * 2 - 1, GAMCS, ngam) + .9375;
            if (n == 0) {
                return value;
            }
            if (n < 0) {
                if (x < -0.5 && Math.abs(x - parseInt(x-0.5,10)/x) < DXREL) {
                    throw("gammafn precision error");
                }
                if (x < xsml) {
                    return (x > 0 ) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
                }

                n = -n;

                for (i=0; i<n; i++) {
                    value /= (x+i);
                }
                return value;
            } else {
                for(i=1; i<=n; i++) {
                    value *= (y+i);
                }
                return value;
            }
        } else {
            if (x > xmax) {
                return Number.POSITIVE_INFINITY;
            }
            if (x < xmin) {
                return 0;
            }
            if (y <= 50 && y == parseInt(y, 10)) {
                value = 1;
                for (i=2; i<y; i++) {
                    value *= i;
                }
            } else {
                value = Math.exp((y-0.5) * Math.log(y) - y - M_LN_SQRT_2PI+
                    ((2 * y == parseInt(2*y,10)) ? stirlerr(y) : lgammacor(y)));
            }
            if (x > 0) {
                return value;
            }
            if (Math.abs(x-parseInt(x-0.5,10)/x) < DXREL) {
                throw("gammafn precision error");
            }
            sinpiy = sinpi(y);
            if(sinpiy ==0) {
                return Number.POSITIVE_INFINITY;
            }
            return -M_PI / (y * sinpiy * value);
        }
    }

    function lgammafn_sign(x) { //, sgn) {
        //we are going to ignore sgn (it's a reference in the orig)
        var ans, y, sinpiy;
        //sgn = 1;
        var xmax = 2.5327372760800758e+305;
        
        if (isNaN(x)) {
            return x;
        }

        if (x < 0 && Math.floor(-x) % 2 == 0) {
            //sgn = -1;
        }
        if (x <=0 && x == Math.trunc(x)) {
            return Number.POSITIVE_INFINITY;
        }

        y = Math.abs(x);
        if (y < 1e-306) return -Math.log(y);
        if (y <= 10) return Math.log(Math.abs(gammafn(x)));

        if (y > xmax) {
            return Number.POSITIVE_INFINITY;
        }
        if (x > 0) {
            if (x > 1e17) {
                return x * (Math.log(x)-1);
            } else if (x > 4934720.) {
                return M_LN_SQRT_2PI + (x - 0.5) * Math.log(x) - x;
            } else {
                return M_LN_SQRT_2PI + (x - 0.5) * Math.log(x) - x + lgammacor(x);
            }
        }
        sinpiy = Math.abs(sinpi(y));

        if (sinpiy == 0) {
            return NaN;
        }

        if (Math.abs((x-Math.trunc(x - 0.5)) * ans / x) < DXREL) {
            throw("lgamma precision error");
        }
        return ans;
    }

    function lgammafn(x) {
        return lgammafn_sign(x, null);
    }

    function stirlerr(n) {
        var nn;
        if (n <= 15) {
            nn = n + n;
            if (nn == Math.floor(nn)) {
                return SFERR_HALVES[Math.floor(nn)];
            }
            return lgammafn(n + 1.0) - (n + 0.5) * Math.log(n) + n - M_LN_SQRT_2PI;
        }

        nn = n*n;
        if (n > 500) {
            return (S0-S1/nn)/n;
        }
        if (n > 80 ) {
            return (S0-(S1-S2/nn)/nn)/n;
        }
        if (n > 35 ) {
            return (S0-(S1-(S2-S3/nn)/nn)/nn)/n;
        }
        return (S0-(S1-(S2-(S3-S4/nn)/nn)/nn)/nn)/n;
    }

    function bd0(x, np) {
        var ej, s, s1, v, j;

        if (!Number.isFinite(x) || !Number.isFinite(np) || np==0) {
            return NaN;
        }
        if (Math.abs(x-np) < 0.1 * (x+np)) {
            v = (x - np)/(x + np);
            s = (x - np) * v;
            if (Math.abs(s) < DBL_MIN) {
                return s;
            }
            ej = 2 * x * v;
            v = v * v;
            for (j=1; j < 1000; j++) {
                ej *= v;
                s1 = s + ej/((j*2)+1);
                if(s1 == s) {
                    return s1;
                }
                s = s1;
            }
        }
        return x * Math.log(x/np) + np - x;
    }

    function dpois_raw(x, lambda, give_log) {
        if (lambda == 0) {
            return (x==1) ? R_D(1,give_log) : R_D(0, give_log);
        }
        if(!Number.isFinite(lambda)) {
            return R_D(0, give_log);
        }
        if (x < 0) {
            return R_D(0, give_log);
        }
        if (x <= lambda * DBL_MIN) {
            return R_D_exp(-lambda, give_log);
        }
        if (lambda < x * DBL_MIN) {
            return R_D_exp(-lambda + x * Math.log(lambda) - lgammafn(x+1), give_log);
        }
        return R_D_fexp(M_2PI *x,-stirlerr(x)-bd0(x, lambda), give_log);
    }

    function logcf(x, i, d, eps) {
        var c1 = 2 * d;
        var c2 = i + d;
        var c3;
        var c4 = c2 + d;
        var a1 = c2;
        var b1 = i * (c2 - i * x);
        var b2 = d * d * x;
        var a2 = c4 * c2 - b2;

        b2 = c4 * b1 - i * b2;
        while(Math.abs(a2 * b1 - a1 * b2) > Math.abs(eps * b1 * b2)) {
            c3 = c2 * c2 * x;
            c2 += d;
            c4 += d;
            a1 = c4 * a2 - c3 * a1;
            b1 = c4 * b2 - c3 * b1;

            c3 = c1 * c1 * x;
            c1 += d;
            c4 += d;
            a2 = c4 * a1 - c3 * a2;
            b2 = c4 * b1 - c3 * b2;

            if (Math.abs(b2) > SCALE_FACTOR) {
                a1 /= SCALE_FACTOR;
                a2 /= SCALE_FACTOR;
                b1 /= SCALE_FACTOR;
                b2 /= SCALE_FACTOR;
            } else if (Math.abs(b2) < 1/SCALE_FACTOR) {
                a1 *= SCALE_FACTOR;
                a2 *= SCALE_FACTOR;
                b1 *= SCALE_FACTOR;
                b2 *= SCALE_FACTOR;
            }
        }
        return a2 / b2;
    }

    function log1pmx(x) {
        var minLog1Value = -0.79149064;
        if (x > 1 || x < minLog1Value) {
            return Math.log1p(x) - x;
        } else {
            var r = x / (2 + x);
            var y = r * r;
            if (Math.abs(x) < 1e-2) {
                return r * ((((2/9 * y + 2/7) * y + 2/5) * y + 2/3) * y - x);
            } else {
                return r * (2 * y * logcf(y, 3, 2, TOL_LOGCF) - x);
            }
        }
    }

    function lgamma1p (a) {
        if (Math.abs(a) >= 0.5) {
            return lgammafn(a + 1);
        }
        var lgam, i;
        lgam = LGAMMA_C * logcf(-a/2, LGAMMA_COEFS.length+2, 1, TOL_LOGCF);
        for(i=LGAMMA_COEFS.length-1; i >= 0; i--) {
            lgam = LGAMMA_COEFS[i] - a * lgam;
        }

        return (a * lgam - EULERS_CONST) * a - log1pmx(a);
    }

    function logspace_add(logx, logy) {
        return ((logx>logy) ? logx : logy) + Math.log1p(Math.exp(-Math.abs(logx-logy)));
    }

    function logspace_sub(logx, logy) {
        return logx + R_Log1_Exp(logy - logx);
    }

    function logspace_sum(logx, n) {
        if (n==0) {return Number.NEGATIVE_INFINITY;}
        if (n==1) {return logx[0];}
        if (n==2) {return logspace_add(logx[0] + logx[1]);}
        var i;
        var Mx = logx[0];
        for(i=1; i<n; i++) {
            if( Mx < logx[i] ) {
                Mx = logx[i];
            }
        }
        var s = 0;
        for(i=0; i<n; i++) {
            s += Math.exp(logx[i] - Mx);
        }
        return Mx + Math.log(s);
    }

    function dpois_wrap(x_plus_1, lambda, give_log) {
        if (!isFinite(lambda)) {
            return R_D(0, give_log);
        }
        if (x_plus_1 > 1) {
            return dpois_raw(x_plus_1-1, lambda, give_log);
        }
        if (lambda > Math.abs(x_plus_1 - 1)*M_CUTOFF) {
            return R_D_exp(-lambda - lgammafn(x_plus_1), give_log);
        } else {
            var d = dpois_raw(x_plus_1, lambda, give_log);
            return (give_log) ? d+Math.log(x_plus_1/lambda): d*(x_plus_1/lambda);
        }
    }

    function R_D(i, log_p) {
        if ( i===0 ) {
            return (log_p) ? Number.NEGATIVE_INFINITY : 0;
        } else {
            return (log_p) ? 0 : 1;
        }
    }

    function R_DT(i, lower_tail, log_p) {
        if ( i===0 ) {
            return (lower_tail) ? R_D(0, log_p) : R_D(1, log_p);
        } else {
            return (lower_tail) ? R_D(1, log_p) : R_D(0, log_p);
        }
    }

    function pgamma_smallx(x, alph, lower_tail, log_p) {
        var sum=0, c=alph, n=0, term;
        do {
            n++;
            c *= -x/n;
            term = c / (alph + n);
            sum += term;
        } while (Math.abs(term) > DBL_EPSILON * Math.abs(sum));

        if (lower_tail) {
            var f1 = (log_p) ? Math.log1p(sum) : 1 + sum;
            var f2;
            if (alph > 1) {
                f2 = dpois_raw(alph, x, log_p);
                f2 = (log_p) ? f2 + x : f2 * Math.exp(x);
            } else if (log_p) {
                f2 = alph * Math.log(x) - lgamma1p(alph);
            } else {
                f2 = Math.pow(x, alph) / Math.exp(lgamma1p(alph));
            }
            return (log_p) ? f1 + f2 : f1 * f2;
        } else {
            var lf2 = alph * Math.log(x) - lgamma1p(alph);
            if (log_p) {
                return R_Log1_Exp(Math.log1p(sum) + lf2);
            } else {
                var f1m1 = sum;
                var f2m1 = Math.expm1(lf2);
                return -(f1m1 + f2m1 + f1m1 * f2m1);
            }
        }

    }

    function pd_upper_series(x, y, log_p) {
        var term = x/y;
        var sum = term;
        do {
            y++;
            term *= x/y;
            sum += term;
        } while (term > sum * DBL_EPSILON);
        return (log_p) ? Math.log(sum) : sum;
    }

    function pd_lower_cf(y, d){
        var f=0, of, f0;
        var i, c2, c3, c4, a1, b1, a2, b2;

        if (y==0) {
            return 0;
        }
        f0 = y/d;
        if(Math.abs(y-1) < Math.abs(d) * DBL_EPSILON) {
            return f0;
        }

        if(f0 > 1.0) {
            f0 = 1.0;
        }
        c2 = y;
        c4 = d;

        a1 = 0; b1 = 1;
        a2 = y; b2 = d;

        while (b2 > SCALE_FACTOR) {
            a1 /= SCALE_FACTOR;
            b1 /= SCALE_FACTOR;
            a2 /= SCALE_FACTOR;
            b2 /= SCALE_FACTOR;
        }

        i=0;
        of = -1;
        while ( i < 200000 ) {
            i++;    c2--;   c3 = i *c2; c4 += 2;
            a1 = c4 * a2 + c3 * a1;
            b1 = c4 * b2 + c3 * b1;

            i++;    c2--;   c3 = i *c2; c4 += 2;
            a2 = c4 * a1 + c3 * a2;
            b2 = c4 * b1 + c3 * b2;

            if (b2 > SCALE_FACTOR) {
                a1 /= SCALE_FACTOR;
                b1 /= SCALE_FACTOR;
                a2 /= SCALE_FACTOR;
                b2 /= SCALE_FACTOR;
            }

            if (b2 != 0) {
                f = a2 / b2;
                if (Math.abs(f - of) <= DBL_EPSILON * ((Math.abs(f) > f0) ? Math.abs(f) : f0)) {
                    return f;
                }
                of = f;
            }
        }
        //WARNING - NON CONVERGENCE
        return f;
    }

    function pd_lower_series(lambda, y) {
        var term=1, sum=0;
        while(y <= 1 && term > sum * DBL_EPSILON) {
            term *= y / lambda;
            sum += term;
            y--;
        }
        if (y != Math.floor(y)) {
            var f = pd_lower_cf (y, lambda+1-y);
            sum += term * f;
        }
        return sum;
    }

    function dpnorm(x, lower_tail, lp) {
        if (x < 0) {
            x = -x;
            lower_tail = !lower_tail;
        }

        if (x > 10 && !lower_tail) {
            var term = 1/x,
                sum = term,
                x2 = x * x,
                i=1;
            do {
                term *= -i / x2;
                sum += term;
                i += 2;
            } while (Math.abs(term) > DBL_EPSILON * sum);

            return 1/sum;
        } else {
            var d = dnorm(x, 0.0, 1.0, false);
            return d/Math.exp(lp);
        }
    }

    function ppois_asymp(x, lambda, lower_tail, log_p) {
        var coefs_a = POIS_COEFS_A, coefs_b = POIS_COEFS_B;
        var elfb, elfb_term;
        var res12, res1_term, res1_ig, res2_term, res2_ig;
        var dfm, pt_, s2pt, f, np;
        var i;

        dfm = lambda - x;
        pt_ = - log1pmx(dfm / x);
        s2pt = Math.sqrt(2 * x * pt_);
        if (dfm < 0) {
            s2pt = -s2pt;
        }

        res12 = 0;
        res1_ig = res1_term = Math.sqrt(x);
        res2_ig = res2_term = s2pt;
        for(i=1; i<8; i++) {
            res12 += res1_ig * coefs_a[i];
            res12 += res2_ig * coefs_b[i];
            res1_term *= pt_ / i;
            res2_term *= 2 * pt_ / (2 * i +1);
            res1_ig = res1_ig / x + res1_term;
            res2_ig = res2_ig / x + res2_term;
        }

        elfb = x;
        elfb_term = 1;
        for(i=1; i<8; i++) {
            elfb += elfb_term * coefs_b[i];
            elfb_term /= x;
        }

        if (!lower_tail) {
            elfb = -elfb;
        }
        f = res12 / elfb;
        np = pnorm(s2pt, 0.0, 1.0, !lower_tail, log_p);
        if (log_p) {
            var n_d_over_p = dpnorm(s2pt, !lower_tail, np);
            return np + Math.log1p(f * n_d_over_p);
        } else {
            var nd = dnorm(s2pt, 0.0, 1.0, log_p);
            return np + f * nd;
        }
    }

    function pgamma_raw(x, alph, lower_tail, log_p) {
        var res, d, sum;
        if (x<1) {
            res = pgamma_smallx(x, alph, lower_tail, log_p);
        } else if (x <= alph - 1 && x < 0.8 * (alph + 50)) {
            // incl large alph compared to x
            sum = pd_upper_series (x, alph, log_p);
            d = dpois_wrap(alph, x, log_p);
            if (!lower_tail) {
                res = (log_p) ? R_Log1_Exp(d + sum) : 1 - d * sum;
            } else {
                res = (log_p) ? sum + d : sum * d;
            }
        } else if ( alph - 1 < x && alph < 0.8 * (x+50)) {
            // incl large x compared to alph
            d = dpois_wrap(alph, x, log_p);
            if ( alph < 1 ) {
                if ( x * DBL_EPSILON > 1 - alph ) {
                    sum = R_D(0, log_p);
                } else {
                    var f = pd_lower_cf(alph, x - (alph - 1)) * x / alph;
                    sum = (log_p) ? Math.log(f) : f;
                }
            } else {
                sum = pd_lower_series(x, alph - 1);
                sum = (log_p) ? Math.log1p(sum) : 1 + sum;
            }
            if (!lower_tail) {
                res = (log_p) ? sum + d : sum * d;
            } else {
                res = (log_p) ? R_Log1_Exp(d + sum) : 1- d*sum;
            }
        } else {
            //x >=1 and x near alph
            res = ppois_asymp(alph-1, x, !lower_tail, log_p);
        }

        if (!log_p && res < DBL_MIN / DBL_EPSILON) {
            return Math.exp(pgamma_raw(x, alph, lower_tail, true));
        } else {
            return res;
        }
    }

    function dpois(x, lambda, give_log) {
        if (lambda < 0) {
            return NaN;
        }
        if (x % 1 !=0) {
            return NaN;
        }
        if (x < 0 || !Number.isFinite(x)) {
            return R_D(0,give_log);
        }
        return dpois_raw(x, lambda, give_log);

    }

    function pgamma(x, alph, scale, lower_tail, log_p) {
        if ( isNaN(x) || alph < 0 || scale < 0 ) {
            return NaN;
        }
        x /= scale;
        if (alph == 0) {
            return (x<=0) ? R_DT(0, lower_tail, log_p): R_DT(1, lower_tail, log_p);
        }
        return pgamma_raw(x, alph, lower_tail, log_p);
    }

    function pchisq(x, df, lower_tail, log_p) {
        return pgamma(x, df/2.0, 2.0, lower_tail, log_p);
    }

    function pnorm_both(x, i_tail, log_p) {
        var cum, ccum;
        var xden, xnum, temp, del, eps, xsq, y;
        var i, lower, upper;
        var a = PNORM_A, b=PNORM_B, c=PNORM_C,
            d = PNORM_D, p=PNORM_P, q=PNORM_Q;

        if (isNaN(x)) {
            return {cum: NaN, ccum: NaN};
        }

        eps = DBL_EPSILON * 0.5;
        lower = i_tail != 1;
        upper = i_tail != 0;

        y = Math.abs(x);
        if (y <= 0.67448975) {
            if (y > eps) {
                xsq = x * x;
                xnum = a[4] * xsq;
                xden = xsq;
                for(i=0; i<3; ++i) {
                    xnum = (xnum + a[i]) * xsq;
                    xden = (xden + b[i]) * xsq;
                }
            }  else {
                xnum = xden = 0.0;
            }
            temp = x * ( xnum + a[3]) / (xden + b[3]);
            if (lower) {
                cum = 0.5 + temp;
            }
            if (upper) {
                ccum = 0.5 - temp;
            }
            if (log_p) {
                if (lower) {cum = Math.log(cum);}
                if (upper) {ccum = Math.log(ccum);}
            }
        } else if (y <= M_SQRT_32) {
            xnum = c[8] * y;
            xden = y;
            for (i=0; i<7; ++i) {
                xnum = (xnum + c[i]) * y;
                xden = (xden + d[i]) * y;
            }
            temp = (xnum + c[7]) / (xden + d[7]);
            //do del (x)
            xsq = Math.trunc(y * 16)/16;
            del = (y - xsq) * (y + xsq);
            if (log_p) {
                cum = (-xsq * xsq * 0.5) + (-del * 0.5) + Math.log(temp);
                if ((lower && x > 0.0) || (upper && x <= 0.0)) {
                    ccum = Math.log1p(-Math.exp(-xsq * xsq * 0.5) *
                        Math.exp(-del * 0.5) * temp);
                } 
            } else {
                cum = Math.exp(-xsq * xsq * 0.5) * 
                    Math.exp(-del * 0.5) * temp;
                ccum = 1.0 - cum;
            }
            //swap tail
            if (x > 0.) {
                temp = cum;
                if (lower) {cum=ccum;}
                ccum = temp;
            }
        } else if ((log_p && y < 1e170) || 
            (lower && -37.5193 < x && x < 8.2924) ||
            (upper && -8.2924 && x < 37.5193)) {

            xsq = 1.0 / (x * x);
            xnum = p[5] * xsq;
            xden = xsq;
            for(i=0; i<4; ++i) {
                xnum = (xnum + p[i]) * xsq;
                xden = (xden + q[i]) * xsq;
            }
            temp = xsq * (xnum + p[4]) / (xden + q[4]);
            temp = (M_1_SQRT_2PI -temp) / y;
            //do del(x)
            xsq = Math.trunc(x * 16)/16;
            del = (x - xsq) * (x + xsq);
            if (log_p) {
                cum = (-xsq * xsq * 0.5) + (-del * 0.5) + Math.log(temp);
                if ((lower && x > 0.0) || (upper && x <= 0.0)) {
                    ccum = Math.log1p(-Math.exp(-xsq * xsq * 0.5) *
                        Math.exp(-del * 0.5) * temp);
                } 
            } else {
                cum = Math.exp(-xsq * xsq * 0.5) * 
                    Math.exp(-del * 0.5) * temp;
                ccum = 1.0 - cum;
            }
            //swap tail
            if (x > 0.) {
                temp = cum;
                if (lower) {cum=ccum;}
                ccum = temp;
            }
        } else {
            if (x>0) {
                cum = R_D(1,log_p);
                ccum = R_D(0, log_p);
            } else {
                cum = R_D(0,log_p);
                ccum = R_D(1,log_p);
            }

        }

        //TODO left off here
        return {cum : cum, ccum: ccum};
    }

    function pnorm(x, mu, sigma, lower_tail, log_p) {
        var p;
        if (isNaN(x) || isNaN(mu) || isNaN(sigma)) {
            return NaN;
        }
        if (!Number.isFinite(x) && mu == x) {
            return NaN;
        }
        if (sigma <=0) {
            if (sigma <0) { return NaN; }
            return (x < mu) ? R_DT(0,lower_tail,log_p) : R_DT(1,lower_tail,log_p);
        }
        p = (x-mu) / sigma;
        if(!Number.isFinite(p)) {
            return (x < mu) ? R_DT(0,lower_tail,log_p) : R_DT(1,lower_tail,log_p);
        }
        x = p;

        var r = pnorm_both(x, (lower_tail)? 0:1 , log_p);
        return (lower_tail) ? r.cum : r.ccum;
    }

    function dnorm(x, mu, sigma, give_log) {
        if (isNaN(x) || isNaN(mu) || isNaN(sigma)) {
            return x + mu + sigma;
        }
        if (!Number.isFinite(sigma)) {return R_D(0, give_log);}
        if (!Number.isFinite(x) && mu == x) {return NaN;}
        if (sigma <=0 ) {
            if (sigma <0) {return NaN;}
            return (x==mu) ? Number.POSITIVE_INFINITY : R_D(0, give_log);
        }
        x = (x-mu) / sigma;
        if (!Number.isFinite(x)) {
            return R_D(0, give_log);
        }
        x = Math.abs(x);
        if (x >= 2 * Math.sqrt(DBL_MAX)) {
            return R_D(0, give_log);
        }
        if (give_log) {
            return -(M_LN_SQRT_2PI + 0.5 * x * x + Math.log(sigma));
        }
        //fast version
        return M_1_SQRT_2PI * Math.exp(-0.5 * x * x) / sigma;
    }

    function parseNumeric(x, default_value) {
        if (typeof(x)==="undefined") {
            return default_value;
        }
        return +x;
    }
    function parseBoolean(x, default_value) {
        if (typeof(x)==="undefined") {
            return default_value;
        }
        return !!((x || "false")!="false");
    }

    return {
        dnorm: function(x, mu, sigma, give_log) {
            x = +x;
            mu = parseNumeric(mu, 0);
            sigma = parseNumeric(sigma, 1);
            give_log = parseBoolean(give_log, false);
            return dnorm(x, mu, sigma, give_log);
        },
        pnorm: function (x, mu, sigma, lower_tail, give_log) {
            x = parseNumeric(x); 
            mu = parseNumeric(mu, 0);
            sigma = parseNumeric(sigma, 1);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log =  parseBoolean(give_log, false)
            return pnorm(x, mu, sigma, lower_tail, give_log);
        },
        pchisq: function (x, df, lower_tail, give_log) {
            x = parseNumeric(x); 
            df = parseNumeric(df);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log =  parseBoolean(give_log, false);
            return pchisq(x, df, lower_tail, give_log);
        },
        pgamma: function(q, shape, scale, lower_tail, give_log) {
            q = parseNumeric(q);
            shape = parseNumeric(shape);
            scale = parseNumeric(scale, 1);
            lower_tail =  parseBoolean(lower_tail, true);
            give_log = parseBoolean(give_log, false);
            return pgamma(q, shape, scale, lower_tail, give_log);
        },
        dpois: function(x, lambda, log) {
            x = parseNumeric(x);
            lambda = parseNumeric(lambda);
            log = parseBoolean(log, false);
            return dpois(x, lambda, log);
        }
    };

})();
