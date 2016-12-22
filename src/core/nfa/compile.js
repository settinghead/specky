var fragment = require( './fragment.js' );
var Spec = require( '../../models/Spec' );
var deref = require( '../../utils/deref' );

var indexedFragmentStates = function( fragment ) {
  var nextIndex = 0;
  var frontier = [ fragment.head ];
  var states = [];
  while ( frontier.length > 0 ) {
    var state = frontier.pop();
    if ( state.index === null ) {
      state.index = nextIndex;
      nextIndex++;
      state.transitions.forEach( ( transition ) => {
        frontier.push( transition.target );
      } );
      states.push( state );
    }
  }
  return states;
};

var evalFunctions = {};

function evalSpec( spec ) {
  spec = deref( spec );
  var evalFn;

  if ( spec.type === null ) {
    throw 'Spec has no type: ' + spec;
  } else if ( !( spec.type in evalFunctions ) ) {
    evalFn = evalFunctions.PRED;
  } else {
    evalFn = evalFunctions[ spec.type ];
  }
  var r = evalFn( spec );
  return r;
}


var evalChildThen = function( wrapper ) {
  return function evalChildThenWrapped( spec ) {
    var childFrag = evalSpec( spec.exprs[ 0 ] );
    return wrapper( childFrag );
  };
};

var evalChildrenThen = function( wrapper ) {
  return function evalChildrenThenWrapped( spec ) {
    var childFrags = spec.exprs.map( ( child ) => {
      var s = evalSpec( child.expr );
      s.name = child.name;
      return s;
    } );
    return wrapper( childFrags );
  };
};

[ 'ROOT',
  'Z_OR_M',
  'O_OR_M',
  'Z_OR_O' ].forEach( ( fragName ) => {
    evalFunctions[ fragName ] = evalChildThen( fragment[ fragName ] );
  } );

[ 'OR',
  'CAT' ].forEach( ( fragName ) => {
    evalFunctions[ fragName ] = evalChildrenThen( fragment[ fragName ] );
  } );

evalFunctions.PRED = ( x ) => {
  return fragment[ 'PRED' ]( x );
};

function wrapRoot( expr ) {
  return new Spec( {
    type: 'ROOT',
    exprs: [ expr ],
    fragments: [],
  } );
}

var compile = function( expr ) {
  var rootedExpr = wrapRoot( expr );
  var fragment = evalSpec( rootedExpr );
  var states = indexedFragmentStates( fragment );
  var numStates = states.length;
  var nfaTransitions = {};
  var finalState;
  states.forEach( ( state ) => {
    if ( state.transitions.length === 0 ) {
      finalState = state.index;
    }
    var outTrans = {};
    state.transitions.forEach( ( fragTrans ) => {
      outTrans[ fragTrans.target.index ] = fragTrans.spec;
    } );
    nfaTransitions[ state.index.toString() ] = outTrans;
  } );
  return {
    initialState: 0,
    numStates: numStates,
    finalState: finalState,
    transitions: nfaTransitions,
    expression: expr,
  };
};

module.exports = compile;
