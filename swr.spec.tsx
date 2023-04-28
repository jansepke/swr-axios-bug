import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import useSWR, { SWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import mockAxios from 'jest-mock-axios';

export const TestProviders: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map(), errorRetryCount: 0 }}>{children}</SWRConfig>
  );
};

afterEach(mockAxios.reset);

interface AppProps {
  onSave: () => {};
  revalidate: boolean;
  dataFetcher: (url: string) => any;
  mutationFetcher: (url: string, { arg }: Readonly<{ arg: never }>) => any;
}

const get = (url: string) => axios.get(url).then((res) => res.data);
const put = (url: string, { arg }: Readonly<{ arg: never }>) => axios.put(url, arg).then((res) => res.data);

const App: React.FC<AppProps> = (props) => {
  const { data } = useSWR('/key', props.dataFetcher);
  const { trigger } = useSWRMutation('/key', props.mutationFetcher, {
    revalidate: props.revalidate, // test fails if set to true (the default)
  });

  const clickHandler = async () => {
    await trigger();
    props.onSave();
  };

  return (
    <>
      {data}
      <button onClick={clickHandler}>Trigger</button>
    </>
  );
};

const renderApp = (props: AppProps) =>
  render(
    <App
      onSave={props.onSave}
      revalidate={props.revalidate}
      dataFetcher={props.dataFetcher}
      mutationFetcher={props.mutationFetcher}
    />,
    { wrapper: TestProviders }
  );

it('fails with axios and revalidation', async () => {
  const onSaveMock = jest.fn();

  renderApp({ onSave: onSaveMock, revalidate: true, dataFetcher: get, mutationFetcher: put });

  mockAxios.mockResponseFor({ url: '/key', method: 'GET' }, { data: 'data' });

  expect(await screen.findByText('data')).not.toBeNull();

  fireEvent.click(screen.getByText('Trigger'));

  mockAxios.mockResponseFor({ url: '/key', method: 'PUT' }, { data: '' });

  await waitFor(() => expect(onSaveMock).toHaveBeenCalled());
});

it('does not fail with axios and without revalidation', async () => {
  const onSaveMock = jest.fn();

  renderApp({ onSave: onSaveMock, revalidate: false, dataFetcher: get, mutationFetcher: put });

  mockAxios.mockResponseFor({ url: '/key', method: 'GET' }, { data: 'data' });

  expect(await screen.findByText('data')).not.toBeNull();

  fireEvent.click(screen.getByText('Trigger'));

  mockAxios.mockResponseFor({ url: '/key', method: 'PUT' }, { data: '' });

  await waitFor(() => expect(onSaveMock).toHaveBeenCalled());
});

it('does not fail without axios and revalidation', async () => {
  const onSaveMock = jest.fn();

  renderApp({
    onSave: onSaveMock,
    revalidate: true,
    dataFetcher: () => Promise.resolve('data'),
    mutationFetcher: () => Promise.resolve(''),
  });

  expect(await screen.findByText('data')).not.toBeNull();

  fireEvent.click(screen.getByText('Trigger'));

  await waitFor(() => expect(onSaveMock).toHaveBeenCalled());
});
