import { combineReducers } from 'redux';
import { configureStore } from '@reduxjs/toolkit';

import { api } from '../services/api';

const reducer = combineReducers({
  [api.reducerPath]: api.reducer,
});

const rootReducer = (state, action) => {
  return reducer(state, action);
};

const middleware = [api.middleware];

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(middleware),
});

export default store;
