import { EModelEndpoint } from 'librechat-data-provider';
import { useFormContext, Controller } from 'react-hook-form';
import InputWithLabel from './InputWithLabel';

const CustomEndpoint = ({
  endpoint,
  userProvideURL,
  userProvideKey = true,
}: {
  endpoint: EModelEndpoint | string;
  userProvideURL?: boolean | null;
  userProvideKey?: boolean;
}) => {
  const { control } = useFormContext();
  return (
    <form className="flex-wrap">
      {userProvideKey && (
        <Controller
          name="apiKey"
          control={control}
          render={({ field }) => (
            <InputWithLabel
              id="apiKey"
              {...field}
              label={`${endpoint} API Key`}
              labelClassName="mb-1"
              inputClassName="mb-2"
            />
          )}
        />
      )}
      {userProvideURL && (
        <Controller
          name="baseURL"
          control={control}
          render={({ field }) => (
            <InputWithLabel
              id="baseURL"
              {...field}
              label={`${endpoint} API URL`}
              labelClassName="mb-1"
            />
          )}
        />
      )}
    </form>
  );
};

export default CustomEndpoint;
