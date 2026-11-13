import type { JsonSnippet } from '../types/app';

export const BUILTIN_JSON_SNIPPETS: JsonSnippet[] = [
  {
    id: 'ind_modbus_field',
    title: 'Industrial Protocol: Modbus RTU / TCP Field',
    category: 'Industrial Protocol',
    kind: 'field',
    description:
      'Config field dropdown for selecting Modbus RTU, Modbus TCP, OPC UA, PROFINET, EtherNet/IP, or CANopen.',
    json: JSON.stringify(
      {
        id: 'industrial_protocol',
        label: 'Industrial Protocol',
        type: 'select',
        options: [
          'Modbus RTU (RS-485)',
          'Modbus TCP/IP',
          'OPC UA',
          'PROFINET IO',
          'EtherNet/IP (CIP)',
          'CANopen / J1939',
          'MQTT Sparkplug B',
          'BACnet/IP',
          'DNP3',
        ],
        default: 'Modbus TCP/IP',
        help: 'Select fieldbus or industrial SCADA protocol.',
      },
      null,
      2
    ),
  },
  {
    id: 'ind_modbus_registers',
    title: 'Industrial Protocol: Modbus Register & Slave Schema',
    category: 'Industrial Protocol',
    kind: 'schema',
    description:
      'Complete tab config JSON for Modbus register maps (slave ID, function code, register address, data format, polling interval).',
    json: JSON.stringify(
      {
        tab_id: 'modbus_registers',
        tab_title: 'Modbus Registers',
        description:
          'Industrial Modbus RTU/TCP register map and PLC tag allocation config.',
        version: '1.0',
        fields: [
          {
            id: 'source_columns',
            label: 'Register Columns',
            type: 'checkbox_group',
            options: [
              'slave_id',
              'function_code',
              'register_address',
              'tag_name',
              'data_type',
              'scale_factor',
              'unit',
              'poll_ms',
            ],
            default: [
              'slave_id',
              'function_code',
              'register_address',
              'tag_name',
              'data_type',
              'poll_ms',
            ],
            help: 'Modbus fields emitted per generated record.',
          },
          {
            id: 'transport',
            label: 'Modbus Transport',
            type: 'select',
            options: ['Modbus TCP (Port 502)', 'Modbus RTU (RS-485)', 'Modbus ASCII'],
            default: 'Modbus TCP (Port 502)',
          },
          {
            id: 'function_code',
            label: 'Function Code',
            type: 'select',
            options: [
              '0x01 Read Coils',
              '0x02 Read Discrete Inputs',
              '0x03 Read Holding Registers',
              '0x04 Read Input Registers',
              '0x06 Write Single Register',
              '0x10 Write Multiple Registers',
            ],
            default: '0x03 Read Holding Registers',
          },
          {
            id: 'slave_id',
            label: 'Unit / Slave ID',
            type: 'number',
            min: 1,
            max: 247,
            default: 1,
          },
          {
            id: 'poll_interval_ms',
            label: 'Polling Interval (ms)',
            type: 'number',
            min: 10,
            max: 60000,
            default: 250,
          },
          {
            id: 'num_records',
            label: 'Number of Registers',
            type: 'number',
            min: 1,
            max: 250,
            default: 8,
          },
        ],
        generator_type: 'generic',
      },
      null,
      2
    ),
  },
  {
    id: 'ind_opcua_endpoint',
    title: 'Industrial Protocol: OPC UA Node & Security Block',
    category: 'Industrial Protocol',
    kind: 'object',
    description:
      'Reusable OPC UA connection & node subscription JSON snippet for PLC / SCADA integration.',
    json: JSON.stringify(
      {
        protocol: 'OPC_UA',
        endpoint_url: 'opc.tcp://192.168.10.20:4840/freeopcua/server/',
        security_mode: 'SignAndEncrypt',
        security_policy: 'Basic256Sha256',
        namespace_index: 2,
        publishing_interval_ms: 500,
        nodes: [
          {
            node_id: 'ns=2;s=Line1.Motor.RPM',
            display_name: 'Motor_RPM',
            data_type: 'Float',
            sampling_interval_ms: 100,
          },
          {
            node_id: 'ns=2;s=Line1.Motor.Fault',
            display_name: 'Motor_Fault',
            data_type: 'Boolean',
            sampling_interval_ms: 100,
          },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'ind_mqtt_sparkplug',
    title: 'Industrial Protocol: MQTT Sparkplug B Payload',
    category: 'Industrial Protocol',
    kind: 'object',
    description:
      'IIoT MQTT Sparkplug B broker & topic namespace configuration JSON snippet.',
    json: JSON.stringify(
      {
        protocol: 'MQTT_Sparkplug_B',
        broker_host: 'mqtts://broker.plant-edge.local:8883',
        topic_prefix: 'spBv1.0',
        group_id: 'PlantFloor_A',
        edge_node_id: 'PLC_Gateway_01',
        device_id: 'VFD_Drive_04',
        qos: 1,
        retain: false,
        keepalive_sec: 30,
        tls_enabled: true,
      },
      null,
      2
    ),
  },
  {
    id: 'ind_canopen_field',
    title: 'Industrial Protocol: CANopen / J1939 Bitrate Field',
    category: 'Industrial Protocol',
    kind: 'field',
    description:
      'Config field dropdown for CANopen / SAE J1939 bus speeds and byte order.',
    json: JSON.stringify(
      {
        id: 'can_bitrate',
        label: 'CAN Bus Bitrate',
        type: 'select',
        options: ['125 kbps', '250 kbps', '500 kbps (J1939)', '800 kbps', '1 Mbps'],
        default: '500 kbps (J1939)',
        help: 'Select CANopen / J1939 bus baud rate.',
      },
      null,
      2
    ),
  },
  {
    id: 'ind_profinet_columns',
    title: 'Industrial Protocol: PROFINET / EtherNet/IP Columns',
    category: 'Industrial Protocol',
    kind: 'field',
    description:
      'Checkbox group field for cyclic industrial Ethernet I/O slot & RPI parameters.',
    json: JSON.stringify(
      {
        id: 'source_columns',
        label: 'Industrial Ethernet Fields',
        type: 'checkbox_group',
        options: [
          'station_name',
          'ip_address',
          'slot',
          'subslot',
          'rpi_ms',
          'input_bytes',
          'output_bytes',
          'watchdog_ms',
        ],
        default: ['station_name', 'ip_address', 'slot', 'rpi_ms', 'input_bytes', 'output_bytes'],
        help: 'Columns included for PROFINET / EtherNet/IP device profiles.',
      },
      null,
      2
    ),
  },
  {
    id: 'field_checkbox_template',
    title: 'Config Field: Checkbox Group Template',
    category: 'Config Fields',
    kind: 'field',
    description: 'Standard checkbox_group field for selecting multiple source columns.',
    json: JSON.stringify(
      {
        id: 'source_columns',
        label: 'Select Source Columns',
        type: 'checkbox_group',
        options: ['id', 'name', 'value', 'unit', 'status', 'timestamp'],
        default: ['id', 'name', 'value', 'status'],
        help: 'Columns included in each generated JSON record.',
      },
      null,
      2
    ),
  },
  {
    id: 'field_select_template',
    title: 'Config Field: Dropdown Select Template',
    category: 'Config Fields',
    kind: 'field',
    description: 'Standard select dropdown field to pick one mode or enum value.',
    json: JSON.stringify(
      {
        id: 'operation_mode',
        label: 'Operation Mode',
        type: 'select',
        options: ['Automatic', 'Manual', 'Diagnostic', 'Calibration'],
        default: 'Automatic',
        help: 'Active runtime mode parameter.',
      },
      null,
      2
    ),
  },
  {
    id: 'field_number_template',
    title: 'Config Field: Numeric Range Template',
    category: 'Config Fields',
    kind: 'field',
    description: 'Numeric field with min/max bounds and default value.',
    json: JSON.stringify(
      {
        id: 'num_records',
        label: 'Number of Records',
        type: 'number',
        min: 1,
        max: 200,
        default: 10,
        help: 'How many records to generate per window.',
      },
      null,
      2
    ),
  },
  {
    id: 'hw_gpio_pins',
    title: 'Hardware: Physical GPIO Pin Map Schema',
    category: 'Hardware / Cloud',
    kind: 'schema',
    description: 'Full tab config schema for microcontroller GPIO pinout & pull/PWM modes.',
    json: JSON.stringify(
      {
        tab_id: 'physical_pins',
        tab_title: 'Physical Pins',
        description: 'Hardware GPIO pin mapping, direction, pull resistors, and ADC/PWM roles.',
        version: '1.0',
        fields: [
          {
            id: 'source_columns',
            label: 'Pin Columns',
            type: 'checkbox_group',
            options: ['pin_number', 'gpio_name', 'signal_role', 'direction', 'pull_mode', 'voltage'],
            default: ['pin_number', 'gpio_name', 'signal_role', 'direction', 'voltage'],
          },
          {
            id: 'mcu_family',
            label: 'Target MCU / PLC',
            type: 'select',
            options: ['ESP32-S3', 'STM32F4', 'RP2040', 'Arduino Mega', 'Industrial PLC'],
            default: 'ESP32-S3',
          },
          {
            id: 'num_records',
            label: 'Number of Pins',
            type: 'number',
            min: 1,
            max: 64,
            default: 8,
          },
        ],
        generator_type: 'generic',
      },
      null,
      2
    ),
  },
];
